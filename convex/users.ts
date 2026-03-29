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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert('users', args);
  },
});

export const updateProfile = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (!existing) return;

    await ctx.db.patch(existing._id, {
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
    });
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
