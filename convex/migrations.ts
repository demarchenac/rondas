import { internalMutation } from './_generated/server';
import { createPlatformTagsForUser } from './tags';

/** Remove comma-separated segments already contained in a prior segment. */
function deduplicateAddress(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!kept.some((prev) => prev.toLowerCase().includes(lower))) {
      kept.push(part);
    }
  }
  return kept.join(', ');
}

/**
 * One-time migration: deduplicate addresses on existing bills.
 * Run from Convex dashboard: npx convex run migrations:deduplicateAddresses
 */
export const deduplicateAddresses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query('bills').collect();
    let updated = 0;

    for (const bill of bills) {
      if (!bill.location?.address) continue;

      const cleaned = deduplicateAddress(bill.location.address);
      if (cleaned !== bill.location.address) {
        await ctx.db.patch(bill._id, {
          location: { ...bill.location, address: cleaned },
        });
        updated++;
      }
    }

    return { total: bills.length, updated };
  },
});

export const migrateContactItemsToUnits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query('bills').collect();
    let updated = 0;

    for (const bill of bills) {
      if (bill.contacts.length === 0) continue;
      const first = bill.contacts[0].items[0];
      if (first && typeof first === 'object' && 'itemId' in first) continue;

      const contacts = bill.contacts.map((c) => ({
        ...c,
        items: (c.items as unknown as string[]).map((itemId) => ({ itemId, units: 1 })),
      }));

      await ctx.db.patch(bill._id, { contacts });
      updated++;
    }

    return { total: bills.length, updated };
  },
});

/**
 * One-time migration: create platform tags for existing users, convert bill.category to tagIds.
 * Run: npx convex run migrations:migrateCategoriesToTags
 */
export const migrateCategoriesToTags = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let tagsCreated = 0;

    for (const user of users) {
      const existingTags = await ctx.db
        .query('tags')
        .withIndex('by_user', (q) => q.eq('userId', user._id))
        .collect();
      if (existingTags.length === 0) {
        await createPlatformTagsForUser(ctx, user._id);
        tagsCreated += 3;
      }
    }

    const bills = await ctx.db.query('bills').collect();
    let billsUpdated = 0;

    for (const bill of bills) {
      if (bill.tagIds && bill.tagIds.length > 0) continue;

      const user = await ctx.db
        .query('users')
        .filter((q) => q.eq(q.field('workosId'), bill.userId))
        .unique();
      if (!user) continue;

      const slug = (bill as unknown as { category?: string }).category || 'dining';
      const platformTag = await ctx.db
        .query('tags')
        .withIndex('by_user_slug', (q) => q.eq('userId', user._id).eq('slug', slug))
        .unique();

      if (platformTag) {
        await ctx.db.patch(bill._id, { tagIds: [platformTag._id] });
        billsUpdated++;
      }
    }

    return { users: users.length, tagsCreated, bills: bills.length, billsUpdated };
  },
});

export const backfillAuthProvider = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    let updated = 0;

    for (const user of users) {
      if (!user.authProvider) {
        await ctx.db.patch(user._id, { authProvider: 'email_otp' });
        updated++;
      }
    }

    return { total: users.length, updated };
  },
});
