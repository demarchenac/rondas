import { mutation, query, type MutationCtx } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Id, Doc } from './_generated/dataModel';
import { getAuthUserId } from './model/auth';

const PLATFORM_TAGS = [
  { name: 'Dining', slug: 'dining', color: '#06b6d4', sortOrder: 0 },
  { name: 'Retail', slug: 'retail', color: '#84cc16', sortOrder: 1 },
  { name: 'Service', slug: 'service', color: '#f43f5e', sortOrder: 2 },
] as const;

const FREE_CUSTOM_TAG_LIMIT = 3;

export async function createPlatformTagsForUser(ctx: MutationCtx, userId: Id<'users'>) {
  for (const tag of PLATFORM_TAGS) {
    await ctx.db.insert('tags', {
      userId,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      isPlatform: true,
      sortOrder: tag.sortOrder,
    });
  }
}

export async function resolvePlatformSlug(
  ctx: { db: { get: (id: Id<'tags'>) => Promise<Doc<'tags'> | null> } },
  tagIds: Id<'tags'>[],
): Promise<string> {
  for (const id of tagIds) {
    const tag = await ctx.db.get(id);
    if (tag?.isPlatform && tag.slug) return tag.slug;
  }
  return 'dining';
}

async function resolveUserDocId(
  ctx: { db: { query: (table: 'users') => any } },
  workosId: string,
): Promise<Id<'users'>> {
  const user = await ctx.db
    .query('users')
    .withIndex('by_workos_id', (q: any) => q.eq('workosId', workosId))
    .unique();
  if (!user) throw new ConvexError({ code: 'NOT_FOUND', message: 'User not found' });
  return user._id;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const workosId = await getAuthUserId(ctx);
    const userDocId = await resolveUserDocId(ctx, workosId);
    return ctx.db
      .query('tags')
      .withIndex('by_user', (q) => q.eq('userId', userDocId))
      .collect()
      .then((tags) => tags.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
    isPro: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const workosId = await getAuthUserId(ctx);
    const userDocId = await resolveUserDocId(ctx, workosId);
    if (args.name.length > 50) throw new ConvexError({ code: 'VALIDATION', message: 'Tag name too long' });

    const existing = await ctx.db
      .query('tags')
      .withIndex('by_user', (q) => q.eq('userId', userDocId))
      .collect();

    if (!args.isPro) {
      const customCount = existing.filter((t) => !t.isPlatform).length;
      if (customCount >= FREE_CUSTOM_TAG_LIMIT) throw new ConvexError({ code: 'LIMIT_REACHED', message: 'custom_tag_limit_reached' });
    }

    const maxOrder = existing.reduce((max, t) => Math.max(max, t.sortOrder), 0);

    return ctx.db.insert('tags', {
      userId: userDocId,
      name: args.name,
      color: args.color,
      isPlatform: false,
      sortOrder: maxOrder < 100 ? 100 : maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('tags'),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const workosId = await getAuthUserId(ctx);
    const userDocId = await resolveUserDocId(ctx, workosId);
    const tag = await ctx.db.get(args.id);
    if (!tag) throw new ConvexError({ code: 'NOT_FOUND', message: 'Tag not found' });
    if (tag.userId !== userDocId) throw new ConvexError({ code: 'UNAUTHORIZED', message: 'Not authorized' });

    if (tag.isPlatform && args.name !== undefined) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Cannot rename platform tags' });
    }
    if (args.name !== undefined && args.name.length > 50) {
      throw new ConvexError({ code: 'VALIDATION', message: 'Tag name too long' });
    }

    const patches: Partial<Doc<'tags'>> = {};
    if (args.color !== undefined) patches.color = args.color;
    if (args.sortOrder !== undefined) patches.sortOrder = args.sortOrder;
    if (args.name !== undefined && !tag.isPlatform) patches.name = args.name;

    if (Object.keys(patches).length > 0) {
      await ctx.db.patch(args.id, patches);
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id('tags'),
  },
  handler: async (ctx, args) => {
    const workosId = await getAuthUserId(ctx);
    const userDocId = await resolveUserDocId(ctx, workosId);
    const tag = await ctx.db.get(args.id);
    if (!tag) throw new ConvexError({ code: 'NOT_FOUND', message: 'Tag not found' });
    if (tag.userId !== userDocId) throw new ConvexError({ code: 'UNAUTHORIZED', message: 'Not authorized' });
    if (tag.isPlatform) throw new ConvexError({ code: 'FORBIDDEN', message: 'Cannot delete platform tags' });

    const bills = await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', workosId))
      .collect();

    for (const bill of bills) {
      if (bill.tagIds?.includes(args.id)) {
        await ctx.db.patch(bill._id, {
          tagIds: bill.tagIds.filter((id) => id !== args.id),
        });
      }
    }

    await ctx.db.delete(args.id);
  },
});
