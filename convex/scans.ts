import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { scanStatusValidator, scanResultValidator } from './validators';

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
    userId: v.string(),
    status: scanStatusValidator,
    result: v.optional(scanResultValidator),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.id);
    if (!scan || scan.userId !== args.userId) {
      throw new Error('Scan not found or access denied');
    }
    const { id, userId, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const getScan = query({
  args: { id: v.id('scans'), userId: v.string() },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.id);
    if (!scan || scan.userId !== args.userId) return null;
    return scan;
  },
});

export const deleteScan = mutation({
  args: { id: v.id('scans'), userId: v.string() },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.id);
    if (!scan || scan.userId !== args.userId) {
      throw new Error('Scan not found or access denied');
    }
    await ctx.db.delete(args.id);
  },
});
