import { mutation, query, type MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

// --- Internal helper (called within mutation handlers) ---

/**
 * Find or create a contact by phone number. Updates name/imageUri if changed.
 * Does NOT modify referenceCount — callers are responsible for incrementing
 * only when adding a contact to a bill for the first time.
 */
export async function getOrCreate(
  ctx: MutationCtx,
  userId: string,
  contact: { name: string; phone: string; imageUri?: string },
): Promise<Id<'contacts'>> {
  const existing = await ctx.db
    .query('contacts')
    .withIndex('by_user_phone', (q) =>
      q.eq('userId', userId).eq('phone', contact.phone),
    )
    .unique();

  if (existing) {
    // Update name/imageUri if changed (contact info may have been updated on device)
    if (existing.name !== contact.name || existing.imageUri !== contact.imageUri) {
      await ctx.db.patch(existing._id, {
        name: contact.name,
        imageUri: contact.imageUri,
      });
    }
    return existing._id;
  }

  return await ctx.db.insert('contacts', {
    userId,
    name: contact.name,
    phone: contact.phone,
    email: undefined,
    imageUri: contact.imageUri,
    referenceCount: 0,
    lastReferencedAt: Date.now(),
  });
}

/** Increment referenceCount when a contact is added to a bill for the first time. */
export async function incrementReference(
  ctx: MutationCtx,
  contactId: Id<'contacts'>,
): Promise<void> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return;
  await ctx.db.patch(contactId, {
    referenceCount: contact.referenceCount + 1,
    lastReferencedAt: Date.now(),
  });
}

export async function decrementReference(
  ctx: MutationCtx,
  contactId: Id<'contacts'>,
): Promise<void> {
  const contact = await ctx.db.get(contactId);
  if (!contact) return;
  await ctx.db.patch(contactId, {
    referenceCount: Math.max(0, contact.referenceCount - 1),
  });
}

// --- Queries ---

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('contacts')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();
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
    if (!contact) throw new Error('Contact not found');
    if (contact.userId !== args.userId) throw new Error('Not authorized');

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
    if (!contact) throw new Error('Contact not found');
    if (contact.userId !== args.userId) throw new Error('Not authorized');

    // .collect() required: Convex can't filter nested arrays, so we scan all bills.
    // Acceptable for contact deletion (rare operation).
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect();

    for (const bill of bills) {
      const filtered = bill.contacts.filter((c) => c.contactId !== args.id);
      if (filtered.length !== bill.contacts.length) {
        await ctx.db.patch(bill._id, { contacts: filtered });
      }
    }

    await ctx.db.delete(args.id);
  },
});
