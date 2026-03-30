import { mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Id, Doc } from './_generated/dataModel';
import {
  billStateValidator,
  splitStrategyValidator,
  categoryValidator,
  billItemValidator,
  locationValidator,
  contactArgValidator,
} from './validators';
import { getOrCreate, incrementReference, decrementReference } from './contacts';

function assertMaxLength(value: string, max: number, field: string) {
  if (value.length > max) throw new Error(`${field} exceeds maximum length of ${max}`);
}

// --- Contact ref type used internally ---

type ContactRef = {
  contactId: Id<'contacts'>;
  items: string[];
  amount: number;
  paid: boolean;
};

// --- Resolve contact refs to full objects for client consumption ---

// Resolves contactId refs to full contact objects for client consumption.
// Cost: ~N reads per bill (N = number of contacts). Acceptable for typical bills (~3 contacts).
async function resolveContacts(
  ctx: { db: { get: (id: Id<'contacts'>) => Promise<Doc<'contacts'> | null> } },
  refs: ContactRef[],
) {
  return Promise.all(
    refs.map(async (ref) => {
      const contact = await ctx.db.get(ref.contactId);
      return {
        ...ref,
        name: contact?.name ?? 'Unknown',
        phone: contact?.phone,
        email: contact?.email,
        imageUri: contact?.imageUri,
      };
    }),
  );
}

// --- Queries ---

export const list = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
    state: v.optional(billStateValidator),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
    country: v.optional(v.string()),
    fromDate: v.optional(v.number()),
    toDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc');

    const hasFilters =
      args.state ||
      args.minAmount != null ||
      args.maxAmount != null ||
      args.country ||
      args.fromDate != null ||
      args.toDate != null;

    if (hasFilters) {
      q = q.filter((qb) => {
        const conditions = [];
        if (args.state) conditions.push(qb.eq(qb.field('state'), args.state));
        if (args.minAmount != null) conditions.push(qb.gte(qb.field('total'), args.minAmount));
        if (args.maxAmount != null) conditions.push(qb.lte(qb.field('total'), args.maxAmount));
        if (args.country) conditions.push(qb.eq(qb.field('country'), args.country));
        if (args.fromDate != null) conditions.push(qb.gte(qb.field('_creationTime'), args.fromDate));
        if (args.toDate != null) conditions.push(qb.lte(qb.field('_creationTime'), args.toDate));
        return conditions.length === 1 ? conditions[0] : qb.and(...conditions);
      });
    }

    const result = await q.paginate(args.paginationOpts);

    // Resolve contact refs to full objects
    const page = await Promise.all(
      result.page.map(async (bill) => ({
        ...bill,
        contacts: await resolveContacts(ctx, bill.contacts),
      })),
    );

    return { ...result, page };
  },
});

export const get = query({
  args: { id: v.id('bills'), userId: v.string() },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill || bill.userId !== args.userId) return null;
    return {
      ...bill,
      contacts: await resolveContacts(ctx, bill.contacts),
    };
  },
});

export const billFilterOptions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // .collect() required for aggregation (counting states) — not a list query
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const billsByState = { draft: 0, unsplit: 0, split: 0, unresolved: 0 };
    let activeBillCount = 0;
    for (const bill of bills) {
      billsByState[bill.state as keyof typeof billsByState]++;
      if (bill.state !== 'draft') activeBillCount++;
    }

    const contacts = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    return { billsByState, activeBillCount, contacts };
  },
});

// --- Mutations ---

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
      }),
    ),
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

    // Decrement reference counts for all contacts on this bill
    for (const ref of bill.contacts) {
      await decrementReference(ctx, ref.contactId);
    }

    await ctx.db.delete(args.id);
  },
});

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
      Object.entries(patches).filter(([, val]) => val !== undefined),
    );
    if (Object.keys(defined).length === 0) return;

    const bill = await ctx.db.get(id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== userId) throw new Error('Not authorized');

    // Backfill IDs for items created before the id field was added
    const billItems = bill.items.map((item) => ({
      ...item,
      id: item.id || crypto.randomUUID(),
    }));
    if (billItems.some((item, i) => item.id !== bill.items[i]?.id)) {
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

    const itemsTotal = newItems.reduce((sum, i) => sum + i.subtotal, 0);
    const isTaxIncluded = billCountry === 'CO';
    const newTotal = isTaxIncluded ? itemsTotal + newTip : itemsTotal + newTax + newTip;

    await ctx.db.patch(id, {
      ...defined,
      contacts,
      total: newTotal,
      updatedAt: Date.now(),
    });
  },
});

// --- Contact assignment mutations ---

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

    const contactId = await getOrCreate(ctx, args.userId, args.contact);
    const contacts = [...bill.contacts];

    const idx = contacts.findIndex((c) => c.contactId === contactId);
    const isNewOnBill = idx < 0;
    if (idx >= 0) {
      if (!contacts[idx].items.includes(args.itemId)) {
        contacts[idx] = { ...contacts[idx], items: [...contacts[idx].items, args.itemId] };
      }
    } else {
      contacts.push({ contactId, items: [args.itemId], amount: 0, paid: false });
    }

    if (isNewOnBill) await incrementReference(ctx, contactId);

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state, splitStrategy: 'by_item' });
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

    const contactId = await getOrCreate(ctx, args.userId, args.contact);
    const contacts = [...bill.contacts];

    const idx = contacts.findIndex((c) => c.contactId === contactId);
    const isNewOnBill = idx < 0;
    if (idx >= 0) {
      const existingItems = new Set(contacts[idx].items);
      for (const itemId of args.itemIds) existingItems.add(itemId);
      contacts[idx] = { ...contacts[idx], items: Array.from(existingItems) };
    } else {
      contacts.push({ contactId, items: [...args.itemIds], amount: 0, paid: false });
    }

    if (isNewOnBill) await incrementReference(ctx, contactId);

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state, splitStrategy: 'by_item' });
  },
});

export const removeContactFromItem = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemId: v.string(),
    contactId: v.id('contacts'),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    let contacts = [...bill.contacts];
    const idx = contacts.findIndex((c) => c.contactId === args.contactId);
    if (idx < 0) throw new Error('Contact not found on this bill');

    const newItems = contacts[idx].items.filter((i) => i !== args.itemId);
    if (newItems.length === 0) {
      contacts.splice(idx, 1);
      await decrementReference(ctx, args.contactId);
    } else {
      contacts[idx] = { ...contacts[idx], items: newItems };
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
    contactIds: v.array(v.id('contacts')),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contactIdSet = new Set(args.contactIds.map(String));
    const contacts = bill.contacts
      .map((c) => ({
        ...c,
        items: contactIdSet.has(String(c.contactId))
          ? c.items.filter((itemId) => !args.itemIds.includes(itemId))
          : c.items,
      }))
      .filter((c) => c.items.length > 0);

    // Decrement reference for contacts fully removed
    for (const ref of bill.contacts) {
      if (!contacts.some((c) => c.contactId === ref.contactId)) {
        await decrementReference(ctx, ref.contactId);
      }
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state });
  },
});

export const togglePaymentStatus = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    contactId: v.id('contacts'),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contacts = bill.contacts.map((c) =>
      c.contactId === args.contactId ? { ...c, paid: !c.paid } : c,
    );
    const state = computeBillState(bill.items, contacts);

    await ctx.db.patch(args.id, { contacts, state });
  },
});

// --- Helpers ---

function computeBillState(
  items: { id?: string; subtotal: number }[],
  contacts: { items: string[]; paid: boolean }[],
): 'unsplit' | 'split' | 'unresolved' {
  if (contacts.length === 0) return 'unsplit';
  const allItemsCovered = items.every((item) =>
    item.id ? contacts.some((c) => c.items.includes(item.id!)) : false,
  );
  const allPaid = contacts.every((c) => c.paid);
  return allItemsCovered && allPaid ? 'split' : 'unresolved';
}

function recalculateAmounts(
  items: { id?: string; subtotal: number }[],
  contacts: ContactRef[],
  tax: number,
  tip: number,
): ContactRef[] {
  const itemsTotal = items.reduce((sum, i) => sum + i.subtotal, 0);

  for (const contact of contacts) {
    contact.items = contact.items.filter((itemId) => items.some((i) => i.id === itemId));

    const contactItemsTotal = contact.items.reduce((sum, itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return sum;
      const numContacts = contacts.filter((c) => c.items.includes(itemId)).length;
      return sum + item.subtotal / numContacts;
    }, 0);

    const share = itemsTotal > 0 ? contactItemsTotal / itemsTotal : 0;
    contact.amount = Math.round(contactItemsTotal + tax * share + tip * share);
  }

  const active = contacts.filter((c) => c.items.length > 0);

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
