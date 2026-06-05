import { mutation, query } from './_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import {
  billStateValidator,
  splitStrategyValidator,
  billItemValidator,
  contactGroupValidator,
  locationValidator,
  contactArgValidator,
} from './validators';
import { getOrCreate, incrementReference, decrementReference } from './model/contacts';
import { resolvePlatformSlug } from './tags';
import {
  assertMaxLength,
  resolveContacts,
  computeBillState,
  computeDisplayTotal,
  computeDerivedFields,
  recalculateAmounts,
  cleanupContactGroups,
  type ContactRef,
} from './model/bills';

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
    let billsQuery = ctx.db
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
      billsQuery = billsQuery.filter((qb) => {
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

    const paginatedBills = await billsQuery.paginate(args.paginationOpts);

    // Fetch all user tags once for in-memory resolution
    const user = await ctx.db.query('users').withIndex('by_workos_id', (q) => q.eq('workosId', args.userId)).unique();
    const userTags = user
      ? await ctx.db.query('tags').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()
      : [];
    const tagMap = new Map(userTags.map((t) => [t._id, t]));

    const page = await Promise.all(
      paginatedBills.page.map(async (bill) => ({
        ...bill,
        contacts: await resolveContacts(ctx, bill.contacts),
        tags: (bill.tagIds ?? []).map((id) => tagMap.get(id)).filter((t): t is NonNullable<typeof t> => t != null),
      })),
    );

    return { ...paginatedBills, page };
  },
});

export const get = query({
  args: { id: v.id('bills'), userId: v.string() },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill || bill.userId !== args.userId) return null;

    const user = await ctx.db.query('users').withIndex('by_workos_id', (q) => q.eq('workosId', args.userId)).unique();
    const userTags = user
      ? await ctx.db.query('tags').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()
      : [];
    const tagMap = new Map(userTags.map((t) => [t._id, t]));

    return {
      ...bill,
      contacts: await resolveContacts(ctx, bill.contacts),
      tags: (bill.tagIds ?? []).map((id) => tagMap.get(id)).filter((t): t is NonNullable<typeof t> => t != null),
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
    let minTotal = Infinity;
    let maxTotal = 0;
    for (const bill of bills) {
      billsByState[bill.state as keyof typeof billsByState]++;
      if (bill.state !== 'draft') {
        activeBillCount++;
        if (bill.total < minTotal) minTotal = bill.total;
        if (bill.total > maxTotal) maxTotal = bill.total;
      }
    }
    // If no active bills, reset to sensible defaults
    if (activeBillCount === 0) { minTotal = 0; maxTotal = 0; }

    const allContacts = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    const contacts = allContacts.filter((c) => !c.isSelf);

    return { billsByState, activeBillCount, contacts, minTotal, maxTotal };
  },
});

// --- Mutations ---

const TRIAL_BILL_LIMIT = 2;
const FREE_MONTHLY_BILL_LIMIT = 3;

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    useCustomTip: v.optional(v.boolean()),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
      }),
    ),
    tagIds: v.optional(v.array(v.id('tags'))),
    category: v.optional(v.string()),
    country: v.optional(v.string()),
    taxIncludedOverride: v.optional(v.boolean()),
    decimalPlaces: v.optional(v.number()),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(locationValidator),
    isPro: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.name, 200, 'Bill name');
    for (const item of args.items) {
      assertMaxLength(item.name, 200, 'Item name');
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.userId))
      .unique();

    const totalBillsCreated = user?.totalBillsCreated ?? 0;
    const proOverride = user?.proOverride === true;
    const isPro = args.isPro === true || proOverride;
    const inTrial = totalBillsCreated < TRIAL_BILL_LIMIT;

    if (!isPro && !inTrial) {
      const now = Date.now();
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthStart = startOfMonth.getTime();

      const billsThisMonth = await ctx.db
        .query('bills')
        .withIndex('by_user', (q) => q.eq('userId', args.userId))
        .collect();
      const count = billsThisMonth.filter((b) => (b.createdAt ?? 0) >= monthStart).length;

      if (count >= FREE_MONTHLY_BILL_LIMIT) {
        throw new Error('monthly_limit_reached');
      }
    }

    const items = args.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }));
    const now = Date.now();

    // Resolve tagIds: use provided tagIds, or resolve from legacy category string
    let tagIds = args.tagIds;
    if ((!tagIds || tagIds.length === 0) && user) {
      const slug = args.category || 'dining';
      const platformTag = await ctx.db
        .query('tags')
        .withIndex('by_user_slug', (q) => q.eq('userId', user._id).eq('slug', slug))
        .unique();
      if (platformTag) tagIds = [platformTag._id];
    }

    const platformSlug = tagIds ? await resolvePlatformSlug(ctx, tagIds) : (args.category || 'dining');
    const { isPro: _isPro, category: _category, tagIds: _tagIds, ...insertArgs } = args;
    const displayTotal = computeDisplayTotal(items, insertArgs, platformSlug);
    const derived = computeDerivedFields(items, []);
    const billId = await ctx.db.insert('bills', {
      ...insertArgs,
      items,
      tagIds: tagIds ?? [],
      state: 'unsplit',
      contacts: [],
      createdAt: now,
      updatedAt: now,
      displayTotal,
      ...derived,
    });

    if (user) {
      await ctx.db.patch(user._id, {
        totalBillsCreated: totalBillsCreated + 1,
      });
    }

    return billId;
  },
});

export const remove = mutation({
  args: { id: v.id('bills'), userId: v.string() },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    for (const ref of bill.contacts) {
      if (!ref.isSelf) await decrementReference(ctx, ref.contactId);
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
    useCustomTip: v.optional(v.boolean()),
    country: v.optional(v.string()),
    taxIncludedOverride: v.optional(v.boolean()),
    numPeople: v.optional(v.number()),
    items: v.optional(v.array(billItemValidator)),
    tagIds: v.optional(v.array(v.id('tags'))),
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

    const itemsTotal = newItems.reduce((subtotalSum, i) => subtotalSum + i.subtotal, 0);
    const overrideVal = (defined.taxIncludedOverride as boolean | undefined) ?? bill.taxIncludedOverride;
    const isTaxIncluded = overrideVal !== undefined ? overrideVal : billCountry === 'CO';
    const newTotal = isTaxIncluded ? itemsTotal + newTip : itemsTotal + newTax + newTip;

    const mergedBill = { ...bill, ...defined, tax: newTax, tip: newTip };
    const effectiveTagIds = (args.tagIds ?? bill.tagIds ?? []) as Id<'tags'>[];
    const platformSlug = effectiveTagIds.length > 0
      ? await resolvePlatformSlug(ctx, effectiveTagIds)
      : 'dining';
    const displayTotal = computeDisplayTotal(newItems, mergedBill, platformSlug);
    const derived = computeDerivedFields(newItems, contacts);

    const contactGroups = contacts.length < bill.contacts.length
      ? cleanupContactGroups(contacts, bill.contactGroups)
      : bill.contactGroups;

    await ctx.db.patch(id, {
      ...defined,
      contacts,
      contactGroups,
      total: newTotal,
      displayTotal,
      ...derived,
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
    const isSelfOverride = args.contact.isSelf ? true : undefined;

    const idx = contacts.findIndex((c) => c.contactId === contactId);
    const isNewOnBill = idx < 0;
    if (idx >= 0) {
      if (!contacts[idx].items.some((i) => i.itemId === args.itemId)) {
        contacts[idx] = { ...contacts[idx], items: [...contacts[idx].items, { itemId: args.itemId, units: 1 }] };
      }
    } else {
      contacts.push({ contactId, isSelf: isSelfOverride, items: [{ itemId: args.itemId, units: 1 }], amount: 0, paid: false });
    }

    if (isNewOnBill && !isSelfOverride) await incrementReference(ctx, contactId);

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(updated);
    const derived = computeDerivedFields(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state, splitStrategy: 'by_item', ...derived });
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
    const isSelfOverride = args.contact.isSelf ? true : undefined;

    const idx = contacts.findIndex((c) => c.contactId === contactId);
    const isNewOnBill = idx < 0;
    if (idx >= 0) {
      const existingItemIds = new Set(contacts[idx].items.map((i) => i.itemId));
      const newItems = [...contacts[idx].items];
      for (const itemId of args.itemIds) {
        if (!existingItemIds.has(itemId)) {
          newItems.push({ itemId, units: 1 });
        }
      }
      contacts[idx] = { ...contacts[idx], items: newItems };
    } else {
      contacts.push({ contactId, isSelf: isSelfOverride, items: args.itemIds.map((itemId) => ({ itemId, units: 1 })), amount: 0, paid: false });
    }

    if (isNewOnBill && !isSelfOverride) await incrementReference(ctx, contactId);

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(updated);
    const derived = computeDerivedFields(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state, splitStrategy: 'by_item', ...derived });
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

    const newItems = contacts[idx].items.filter((i) => i.itemId !== args.itemId);
    if (newItems.length === 0) {
      const wasSelf = contacts[idx].isSelf;
      contacts.splice(idx, 1);
      if (!wasSelf) await decrementReference(ctx, args.contactId);
    } else {
      contacts[idx] = { ...contacts[idx], items: newItems };
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(updated);
    const derived = computeDerivedFields(bill.items, updated);
    const contactGroups = cleanupContactGroups(updated, bill.contactGroups);

    await ctx.db.patch(args.id, { contacts: updated, state, contactGroups, ...derived });
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
          ? c.items.filter((i) => !args.itemIds.includes(i.itemId))
          : c.items,
      }))
      .filter((c) => c.items.length > 0);

    for (const ref of bill.contacts) {
      if (!ref.isSelf && !contacts.some((c) => c.contactId === ref.contactId)) {
        await decrementReference(ctx, ref.contactId);
      }
    }

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(updated);
    const derived = computeDerivedFields(bill.items, updated);
    const contactGroups = cleanupContactGroups(updated, bill.contactGroups);

    await ctx.db.patch(args.id, { contacts: updated, state, contactGroups, ...derived });
  },
});

export const updateContactUnits = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    itemId: v.string(),
    contactId: v.id('contacts'),
    units: v.number(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');
    if (args.units < 1) throw new Error('Units must be at least 1');

    const item = bill.items.find((i) => i.id === args.itemId);
    if (!item) throw new Error('Item not found');

    const contacts = [...bill.contacts];
    const idx = contacts.findIndex((c) => c.contactId === args.contactId);
    if (idx < 0) throw new Error('Contact not found on this bill');

    contacts[idx] = {
      ...contacts[idx],
      items: contacts[idx].items.map((ref) =>
        ref.itemId === args.itemId ? { ...ref, units: args.units } : ref,
      ),
    };

    const updated = recalculateAmounts(bill.items, contacts, bill.tax ?? 0, bill.tip ?? 0);
    const state = computeBillState(updated);
    const derived = computeDerivedFields(bill.items, updated);

    await ctx.db.patch(args.id, { contacts: updated, state, ...derived });
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
    const state = computeBillState(contacts);
    const derived = computeDerivedFields(bill.items, contacts);

    await ctx.db.patch(args.id, { contacts, state, ...derived });
  },
});

// --- Equal split mutations ---

export const assignEqualSplit = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    numPeople: v.number(),
    contacts: v.array(contactArgValidator),
  },
  handler: async (ctx, args) => {
    if (args.numPeople < 2 || args.numPeople > 20) {
      throw new Error('Number of people must be between 2 and 20');
    }
    for (const c of args.contacts) {
      assertMaxLength(c.name, 100, 'Contact name');
    }
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const perPerson = Math.floor(bill.total / args.numPeople);
    const remainder = bill.total - perPerson * args.numPeople;

    for (const ref of bill.contacts) {
      if (!ref.isSelf) await decrementReference(ctx, ref.contactId);
    }

    const contacts: ContactRef[] = [];
    for (let i = 0; i < args.contacts.length; i++) {
      const contact = args.contacts[i];
      const contactId = await getOrCreate(ctx, args.userId, contact);
      const isSelfOverride = contact.isSelf ? true : undefined;
      if (!isSelfOverride) await incrementReference(ctx, contactId);
      contacts.push({
        contactId,
        isSelf: isSelfOverride,
        items: [],
        amount: i === 0 ? perPerson + remainder : perPerson,
        paid: false,
      });
    }

    // Preserve paid status for contacts that were already on the bill
    for (const newContact of contacts) {
      const prev = bill.contacts.find((c) => c.contactId === newContact.contactId);
      if (prev) newContact.paid = prev.paid;
    }

    const state = computeBillState(contacts);
    const derived = computeDerivedFields(bill.items, contacts);

    await ctx.db.patch(args.id, {
      contacts,
      state,
      splitStrategy: 'equal',
      numPeople: args.numPeople,
      updatedAt: Date.now(),
      ...derived,
    });
  },
});

// --- Contact group mutations ---

export const updateContactGroups = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    groups: v.array(contactGroupValidator),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const contactIdSet = new Set(bill.contacts.map((c) => String(c.contactId)));
    for (const group of args.groups) {
      for (const cid of group.contactIds) {
        if (!contactIdSet.has(String(cid))) throw new Error('Contact not found on this bill');
      }
      assertMaxLength(group.name, 200, 'Group name');
    }

    const cleaned = cleanupContactGroups(bill.contacts, args.groups);
    await ctx.db.patch(args.id, { contactGroups: cleaned, updatedAt: Date.now() });
  },
});

export const toggleGroupPaymentStatus = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
    groupId: v.string(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    const group = bill.contactGroups?.find((g) => g.id === args.groupId);
    if (!group) throw new Error('Group not found');

    const memberIds = new Set(group.contactIds.map(String));
    const members = bill.contacts.filter((c) => memberIds.has(String(c.contactId)));
    const allPaid = members.every((c) => c.paid);
    const targetPaid = !allPaid;

    const contacts = bill.contacts.map((c) =>
      memberIds.has(String(c.contactId)) ? { ...c, paid: targetPaid } : c,
    );
    const state = computeBillState(contacts);
    const derived = computeDerivedFields(bill.items, contacts);

    await ctx.db.patch(args.id, { contacts, state, ...derived });
  },
});

export const clearSplitAssignments = mutation({
  args: {
    id: v.id('bills'),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error('Bill not found');
    if (bill.userId !== args.userId) throw new Error('Not authorized');

    for (const ref of bill.contacts) {
      if (!ref.isSelf) await decrementReference(ctx, ref.contactId);
    }

    const derived = computeDerivedFields(bill.items, []);

    await ctx.db.patch(args.id, {
      contacts: [],
      contactGroups: undefined,
      state: 'unsplit',
      splitStrategy: undefined,
      numPeople: undefined,
      updatedAt: Date.now(),
      ...derived,
    });
  },
});

