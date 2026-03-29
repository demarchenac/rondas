import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const createScan = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert('scans', {
      userId: args.userId,
      status: 'analyzing',
    });
  },
});

export const updateScan = mutation({
  args: {
    id: v.id('scans'),
    status: v.union(
      v.literal('analyzing'),
      v.literal('thinking'),
      v.literal('extracting'),
      v.literal('complete'),
      v.literal('error')
    ),
    result: v.optional(v.object({
      category: v.string(),
      items: v.array(v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        subtotal: v.number(),
      })),
      tax: v.number(),
      tip: v.number(),
      total: v.number(),
    })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const getScan = query({
  args: { id: v.id('scans') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const deleteScan = mutation({
  args: { id: v.id('scans') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
