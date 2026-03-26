import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect();
  },
});

export const listByState = query({
  args: {
    userId: v.string(),
    state: v.union(
      v.literal('unsplit'),
      v.literal('split'),
      v.literal('unresolved')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_user_state', (q) =>
        q.eq('userId', args.userId).eq('state', args.state)
      )
      .order('desc')
      .collect();
  },
});

export const get = query({
  args: { id: v.id('bills') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('bills', {
      ...args,
      state: 'unsplit',
      contacts: [],
    });
  },
});

export const remove = mutation({
  args: { id: v.id('bills') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
