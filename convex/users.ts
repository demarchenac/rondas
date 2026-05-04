import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

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

export const count = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect();
    return users.length;
  },
});

export const getByWorkosId = query({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();
  },
});

export const createUser = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert('users', {
      ...args,
      authProvider: args.authProvider ?? 'email_otp',
    });
  },
});

export const updateProfile = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
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
    workosId: v.string(),
    config: configValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (!existing) throw new Error('User not found');

    await ctx.db.patch(existing._id, { config: args.config });
  },
});
