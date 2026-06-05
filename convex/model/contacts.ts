import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';

export async function getOrCreate(
  ctx: MutationCtx,
  userId: string,
  contact: { name: string; phone?: string; isSelf?: boolean; imageUri?: string },
): Promise<Id<'contacts'>> {
  if (contact.isSelf) {
    return getOrCreateSelf(ctx, userId, { name: contact.name, imageUri: contact.imageUri });
  }

  if (!contact.phone) {
    return await ctx.db.insert('contacts', {
      userId,
      name: contact.name,
      phone: undefined,
      email: undefined,
      imageUri: contact.imageUri,
      referenceCount: 0,
      lastReferencedAt: Date.now(),
    });
  }

  const existing = await ctx.db
    .query('contacts')
    .withIndex('by_user_phone', (q) =>
      q.eq('userId', userId).eq('phone', contact.phone),
    )
    .unique();

  if (existing) {
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

export async function getOrCreateSelf(
  ctx: MutationCtx,
  userId: string,
  profile: { name?: string; imageUri?: string },
): Promise<Id<'contacts'>> {
  const all = await ctx.db
    .query('contacts')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect();
  const existing = all.find((c) => c.isSelf === true);

  if (existing) {
    const patches: Record<string, unknown> = {};
    if (profile.name && profile.name !== existing.name) patches.name = profile.name;
    if (profile.imageUri !== undefined && profile.imageUri !== existing.imageUri) patches.imageUri = profile.imageUri;
    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(existing._id, patches);
    }
    return existing._id;
  }

  return await ctx.db.insert('contacts', {
    userId,
    name: profile.name ?? 'Me',
    isSelf: true,
    email: undefined,
    imageUri: profile.imageUri,
    referenceCount: 0,
    lastReferencedAt: Date.now(),
  });
}

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
