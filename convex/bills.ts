import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

export const listByState = query({
  args: {
    userId: v.string(),
    state: v.union(
      v.literal('draft'),
      v.literal('unsplit'),
      v.literal('split'),
      v.literal('unresolved')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user_state', (q) =>
        q.eq('userId', args.userId).eq('state', args.state)
      )
      .order('desc')
      .collect();
  },
});

export const get = query({
  args: { id: v.id('bills') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
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
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
      })
    ),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      address: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const items = args.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
    return await ctx.db.insert('bills', {
      ...args,
      items,
      state: 'draft',
      contacts: [],
    });
  },
});

export const remove = mutation({
  args: { id: v.id('bills') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// --- Bill update mutations ---

export const update = mutation({
  args: {
    id: v.id('bills'),
    name: v.optional(v.string()),
    state: v.optional(
      v.union(v.literal('draft'), v.literal('unsplit'), v.literal('split'), v.literal('unresolved'))
    ),
    splitStrategy: v.optional(v.union(v.literal('equal'), v.literal('by_item'))),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    items: v.optional(
      v.array(
        v.object({
          id: v.optional(v.string()),
          name: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
          subtotal: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...patches } = args;
    const defined = Object.fromEntries(
      Object.entries(patches).filter(([, val]) => val !== undefined)
    );
    if (Object.keys(defined).length === 0) return;

    // If items, tax, or tip changed, recalculate contact amounts and total
    const bill = await ctx.db.get(id);
    if (!bill) throw new Error('Bill not found');

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

    let contacts = bill.contacts;
    if (contacts.length > 0 && (defined.items || defined.tax !== undefined || defined.tip !== undefined)) {
      contacts = recalculateAmounts(newItems, [...contacts], newTax, newTip);
    }

    const newTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0) + newTax + newTip;

    await ctx.db.patch(id, {
      ...defined,
      contacts,
      total: newTotal,
    });
  },
});

function computeBillState(
  items: { subtotal: number }[],
  contacts: { items: number[]; paid: boolean }[]
): 'unsplit' | 'split' | 'unresolved' {
  if (contacts.length === 0) return 'unsplit';
  const allItemsCovered = items.every((_, i) =>
    contacts.some((c) => c.items.includes(i))
  );
  const allPaid = contacts.every((c) => c.paid);
  return allItemsCovered && allPaid ? 'split' : 'unresolved';
}

function recalculateAmounts(
  items: { subtotal: number }[],
  contacts: { name: string; phone?: string; email?: string; items: number[]; amount: number; paid: boolean }[],
  tax: number,
  tip: number
) {
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);

  for (const contact of contacts) {
    const contactItemsTotal = contact.items.reduce((sum, idx) => {
      const item = items[idx];
      if (!item) return sum;
      const numContacts = contacts.filter((c) => c.items.includes(idx)).length;
      return sum + item.subtotal / numContacts;
    }, 0);

    // Proportional share of tax and tip
    const share = itemsTotal > 0 ? contactItemsTotal / itemsTotal : 0;
    contact.amount = Math.round(contactItemsTotal + (tax * share) + (tip * share));
  }

  return contacts;
}

export const assignContactToItem = mutation({
  args: {
    id: v.id('bills'),
    itemIndex: v.number(),
    contact: v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      imageUri: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');

    const contacts = [...bill.contacts];

    // Find existing contact by name + phone
    let contactIdx = contacts.findIndex(
      (c) => c.name === args.contact.name && c.phone === args.contact.phone
    );

    if (contactIdx >= 0) {
      // Add item to existing contact if not already assigned
      if (!contacts[contactIdx].items.includes(args.itemIndex)) {
        contacts[contactIdx] = {
          ...contacts[contactIdx],
          items: [...contacts[contactIdx].items, args.itemIndex],
        };
      }
    } else {
      // Add new contact
      contacts.push({
        name: args.contact.name,
        phone: args.contact.phone,
        imageUri: args.contact.imageUri,
        email: undefined,
        items: [args.itemIndex],
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
    itemIndices: v.array(v.number()),
    contact: v.object({
      name: v.string(),
      phone: v.optional(v.string()),
      imageUri: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');

    const contacts = [...bill.contacts];

    let contactIdx = contacts.findIndex(
      (c) => c.name === args.contact.name && c.phone === args.contact.phone
    );

    if (contactIdx >= 0) {
      const existingItems = new Set(contacts[contactIdx].items);
      for (const idx of args.itemIndices) existingItems.add(idx);
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
        items: [...args.itemIndices],
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
    itemIndex: v.number(),
    contactIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');

    let contacts = [...bill.contacts];
    const contact = contacts[args.contactIndex];
    if (!contact) throw new Error('Contact not found');

    // Remove item from contact
    const newItems = contact.items.filter((i) => i !== args.itemIndex);

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

export const togglePaymentStatus = mutation({
  args: {
    id: v.id('bills'),
    contactIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');

    const contacts = [...bill.contacts];
    const contact = contacts[args.contactIndex];
    if (!contact) throw new Error('Contact not found');

    contacts[args.contactIndex] = { ...contact, paid: !contact.paid };
    const state = computeBillState(bill.items, contacts);

    await ctx.db.patch(args.id, { contacts, state });
  },
});
