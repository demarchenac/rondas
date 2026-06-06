import { internalQuery, mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { createPlatformTagsForUser } from './tags';
import { getAuthUserId } from './model/auth';

const configValidator = v.object({
  country: v.string(),
  usState: v.optional(v.string()),
  defaultTipPercent: v.number(),
  language: v.string(),
  theme: v.string(),
  extractPhotoTime: v.boolean(),
  useLocation: v.boolean(),
  impoconsumoIncluded: v.optional(v.boolean()),
  ivaIncluded: v.optional(v.boolean()),
});

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', userId))
      .unique();
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', userId))
      .unique();

    if (existing) return existing._id;

    const docId = await ctx.db.insert('users', {
      workosId: userId,
      ...args,
      authProvider: args.authProvider ?? 'email_otp',
    });

    await createPlatformTagsForUser(ctx, docId);

    return docId;
  },
});

export const updateProfile = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', userId))
      .unique();

    if (!existing) return;

    const patches: Record<string, unknown> = {
      email: args.email,
      name: args.name,
    };

    if (args.authProvider && args.authProvider !== existing.authProvider) {
      patches.authProvider = args.authProvider;
      if (args.avatarUrl) patches.avatarUrl = args.avatarUrl;
    } else {
      patches.avatarUrl = args.avatarUrl;
    }

    await ctx.db.patch(existing._id, patches);
  },
});

export const getProStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', userId))
      .unique();

    if (!user) return { proOverride: false, totalBillsCreated: 0 };

    return {
      proOverride: user.proOverride === true,
      totalBillsCreated: user.totalBillsCreated ?? 0,
    };
  },
});

export const internalGetProStatus = internalQuery({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (!user) return { proOverride: false, totalBillsCreated: 0 };

    return {
      proOverride: user.proOverride === true,
      totalBillsCreated: user.totalBillsCreated ?? 0,
    };
  },
});

export const updateConfig = mutation({
  args: {
    config: configValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', userId))
      .unique();

    if (!existing) throw new ConvexError({ code: 'NOT_FOUND', message: 'User not found' });

    await ctx.db.patch(existing._id, { config: args.config });
  },
});
