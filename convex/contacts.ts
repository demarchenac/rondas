import { mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { getOrCreateSelf } from './model/contacts';
import { computeDerivedFields } from './model/bills';

// --- Queries ---

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    return all.filter((c) => !c.isSelf);
  },
});

export const getSelf = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
    return all.find((c) => c.isSelf === true) ?? null;
  },
});

export const suggested = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const referenced = all.filter((c) => c.referenceCount > 0 && !c.isSelf);

    const frequent = [...referenced]
      .sort((a, b) => b.referenceCount - a.referenceCount)
      .slice(0, 4);

    const frequentIds = new Set(frequent.map((c) => c._id));
    const recent = [...referenced]
      .sort((a, b) => b.lastReferencedAt - a.lastReferencedAt)
      .filter((c) => !frequentIds.has(c._id))
      .slice(0, 4);

    return { frequent, recent };
  },
});

export const syncFromDevice = mutation({
  args: {
    userId: v.string(),
    deviceContacts: v.array(
      v.object({
        phone: v.string(),
        name: v.string(),
        imageUri: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const allContacts = await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    const deviceByPhone = new Map(
      args.deviceContacts.map((c) => [c.phone, c]),
    );

    let updated = 0;
    for (const contact of allContacts) {
      if (contact.isSelf || !contact.phone) continue;
      const device = deviceByPhone.get(contact.phone);
      if (!device) continue;

      const patches: Record<string, unknown> = {};
      if (device.name !== contact.name) patches.name = device.name;
      if (device.imageUri !== contact.imageUri) patches.imageUri = device.imageUri;

      if (Object.keys(patches).length > 0) {
        await ctx.db.patch(contact._id, patches);
        updated++;
      }
    }

    return { updated };
  },
});

export const syncSelfContact = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    imageUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getOrCreateSelf(ctx, args.userId, { name: args.name, imageUri: args.imageUri });
  },
});

// --- Mutations ---

export const update = mutation({
  args: {
    id: v.id('contacts'),
    userId: v.string(),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    imageUri: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact) throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    if (contact.userId !== args.userId) throw new ConvexError({ code: 'UNAUTHORIZED', message: 'Not authorized' });

    const patches: Record<string, unknown> = {};
    if (args.name !== undefined) patches.name = args.name;
    if (args.phone !== undefined) patches.phone = args.phone;
    if (args.imageUri !== undefined) patches.imageUri = args.imageUri;

    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(args.id, patches);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id('contacts'),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.id);
    if (!contact) throw new ConvexError({ code: 'NOT_FOUND', message: 'Contact not found' });
    if (contact.userId !== args.userId) throw new ConvexError({ code: 'UNAUTHORIZED', message: 'Not authorized' });

    // .collect() required: Convex can't filter nested arrays, so we scan all bills.
    // Acceptable for contact deletion (rare operation).
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    for (const bill of bills) {
      const filtered = bill.contacts.filter((c) => c.contactId !== args.id);
      if (filtered.length !== bill.contacts.length) {
        const derived = computeDerivedFields(bill.items, filtered);
        await ctx.db.patch(bill._id, { contacts: filtered, ...derived });
      }
    }

    await ctx.db.delete(args.id);
  },
});
