import { mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import {
  billStateValidator,
  splitStrategyValidator,
  categoryValidator,
  billItemValidator,
  locationValidator,
  contactArgValidator,
} from './validators';

function assertMaxLength(value: string, max: number, field: string) {
  if (value.length > max) throw new Error(`${field} exceeds maximum length of ${max}`);
}

export const list = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .paginate(args.paginationOpts);
  },
});

export const listByState = query({
  args: {
    userId: v.string(),
    state: billStateValidator,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user_state', (q) =>
        q.eq('userId', args.userId).eq('state', args.state)
      )
      .order('desc')
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: { id: v.id('bills'), userId: v.string() },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (bill && bill.userId !== args.userId) return null;
    return bill;
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    items: v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      subtotal: v.number(),
    })),
    category: v.optional(categoryValidator),
    country: v.optional(v.string()),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(locationValidator),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.name, 200, 'Bill name');
    for (const item of args.items) {
      assertMaxLength(item.name, 200, 'Item name');
    }
    const items = args.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
    const now = Date.now();
    return await ctx.db.insert('bills', {
      ...args,
      items,
      state: 'draft',
      contacts: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id('bills'), userId: v.string() },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');
    await ctx.db.delete(args.id);
  },
});

// --- Bill update mutations ---

export const update = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    name: v.optional(v.string()),
    state: v.optional(billStateValidator),
    splitStrategy: v.optional(splitStrategyValidator),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    country: v.optional(v.string()),
    items: v.optional(v.array(billItemValidator)),
  },
  handler: async (ctx, args) => {
    if (args.name !== undefined) assertMaxLength(args.name, 200, 'Bill name');
    if (args.items) {
      for (const item of args.items) {
        assertMaxLength(item.name, 200, 'Item name');
      }
    }
    const { id, userId, ...patches } = args;
    const defined = Object.fromEntries(
      Object.entries(patches).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(defined).length === 0) return;

    // If items, tax, or tip changed, recalculate contact amounts and total
    const bill = await ctx.db.get(id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== userId) throw new Error('Not authorized');

    // Backfill IDs for items created before the id field was added
    const billItems = bill.items.map((item) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
    }));
    if (billItems.some((item, i) => item.id !== bill.items[i]?.id)) {
      // Items were missing IDs, persist the backfill
      await ctx.db.patch(id, { items: billItems });
    }

    const newItems = (defined.items as typeof bill.items) ?? billItems;
    const newTax = (defined.tax as number) ?? bill.tax ?? 0;
    const newTip = (defined.tip as number) ?? bill.tip ?? 0;
    const billCountry = bill.country as string | undefined;

    let contacts = bill.contacts;
    if (contacts.length > 0 && (defined.items || defined.tax !== undefined || defined.tip !== undefined)) {
      contacts = recalculateAmounts(newItems, [...contacts], newTax, newTip);
    }

    // Total = itemsTotal + tip for CO (tax already in prices), itemsTotal + tax + tip for US
    const itemsTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
    const isTaxIncluded = billCountry === 'CO';
    const newTotal = isTaxIncluded
      ? itemsTotal + newTip
      : itemsTotal + newTax + newTip;

    await ctx.db.patch(id, {
      ...defined,
      contacts,
      total: newTotal,
      updatedAt: Date.now(),
    });
  },
});

function computeBillState(
  items: { id?: string; subtotal: number }[],
  contacts: { items: string[]; paid: boolean }[]
): 'unsplit' | 'split' | 'unresolved' {
  if (contacts.length === 0) return 'unsplit';
  const allItemsCovered = items.every((item) =>
    item.id ? contacts.some((c) => c.items.includes(item.id!)) : false
  );
  const allPaid = contacts.every((c) => c.paid);
  return allItemsCovered && allPaid ? 'split' : 'unresolved';
}

function recalculateAmounts(
  items: { id?: string; subtotal: number }[],
  contacts: { name: string; phone?: string; email?: string; imageUri?: string; items: string[]; amount: number; paid: boolean }[],
  tax: number,
  tip: number
) {
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);

  for (const contact of contacts) {
    // Clean up stale item references
    contact.items = contact.items.filter((itemId) =>
      items.some((i) => i.id === itemId)
    );

    const contactItemsTotal = contact.items.reduce((sum, itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return sum;
      const numContacts = contacts.filter((c) => c.items.includes(itemId)).length;
      return sum + item.subtotal / numContacts;
    }, 0);

    const share = itemsTotal > 0 ? contactItemsTotal / itemsTotal : 0;
    contact.amount = Math.round(contactItemsTotal + (tax * share) + (tip * share));
  }

  // Remove contacts with no items left
  const active = contacts.filter((c) => c.items.length > 0);

  // Distribute rounding remainder to first contact so amounts sum correctly
  if (active.length > 0) {
    const expectedTotal = itemsTotal + tax + tip;
    const roundedSum = active.reduce((sum, c) => sum + c.amount, 0);
    const remainder = Math.round(expectedTotal) - roundedSum;
    if (remainder !== 0) {
      active[0].amount += remainder;
    }
  }

  return active;
}

export const assignContactToItem = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemId: v.string(),
    contact: contactArgValidator,
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.contact.name, 100, 'Contact name');
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contacts = [...bill.contacts];

    let contactIdx = contacts.findIndex(
      (c) => c.name === args.contact.name && c.phone === args.contact.phone
    );

    if (contactIdx >= 0) {
      if (!contacts[contactIdx].items.includes(args.itemId)) {
        contacts[contactIdx] = {
          ...contacts[contactIdx],
          items: [...contacts[contactIdx].items, args.itemId],
        };
      }
    } else {
      contacts.push({
        name: args.contact.name,
        phone: args.contact.phone,
        imageUri: args.contact.imageUri,
        email: undefined,
        items: [args.itemId],
        amount: 0,
        paid: false,
      });
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, {
      contacts: updated,
      state,
      splitStrategy: 'by_item',
    });
  },
});

export const assignContactToItems = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemIds: v.array(v.string()),
    contact: contactArgValidator,
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.contact.name, 100, 'Contact name');
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contacts = [...bill.contacts];

    let contactIdx = contacts.findIndex(
      (c) => c.name === args.contact.name && c.phone === args.contact.phone
    );

    if (contactIdx >= 0) {
      const existingItems = new Set(contacts[contactIdx].items);
      for (const itemId of args.itemIds) existingItems.add(itemId);
      contacts[contactIdx] = {
        ...contacts[contactIdx],
        items: Array.from(existingItems),
      };
    } else {
      contacts.push({
        name: args.contact.name,
        phone: args.contact.phone,
        imageUri: args.contact.imageUri,
        email: undefined,
        items: [...args.itemIds],
        amount: 0,
        paid: false,
      });
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, {
      contacts: updated,
      state,
      splitStrategy: 'by_item',
    });
  },
});

export const removeContactFromItem = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemId: v.string(),
    contactIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    let contacts = [...bill.contacts];
    const contact = contacts[args.contactIndex];
    if (!contact) throw new Error('Contact not found');

    const newItems = contact.items.filter((i) => i !== args.itemId);

    if (newItems.length === 0) {
      // Remove contact entirely
      contacts.splice(args.contactIndex, 1);
    } else {
      contacts[args.contactIndex] = { ...contact, items: newItems };
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state });
  },
});

export const removeContactsFromItems = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemIds: v.array(v.string()),
    contactNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    let contacts = bill.contacts.map((c) => ({
      ...c,
      items: args.contactNames.includes(c.name)
        ? c.items.filter((itemId) => !args.itemIds.includes(itemId as string))
        : c.items,
    })).filter((c) => c.items.length > 0);

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state });
  },
});

export const togglePaymentStatus = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    contactIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contacts = [...bill.contacts];
    const contact = contacts[args.contactIndex];
    if (!contact) throw new Error('Contact not found');

    contacts[args.contactIndex] = { ...contact, paid: !contact.paid };
    const state = computeBillState(bill.items, contacts);

    await ctx.db.patch(args.id, { contacts, state });
  },
});
