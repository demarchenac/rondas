import { internalMutation, mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { scanStatusValidator, scanResultValidator } from './validators';
import { getAuthUserId } from './model/auth';

export const createScan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert('scans', {
      userId,
      status: 'analyzing',
    });
  },
});

export const updateScan = internalMutation({
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
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Scan not found or access denied' });
    }
    const { id, userId, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const getScan = query({
  args: { id: v.id('scans') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const scan = await ctx.db.get(args.id);
    if (!scan || scan.userId !== userId) return null;
    return scan;
  },
});

export const deleteScan = mutation({
  args: { id: v.id('scans') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const scan = await ctx.db.get(args.id);
    if (!scan || scan.userId !== userId) {
      throw new ConvexError({ code: 'NOT_FOUND', message: 'Scan not found or access denied' });
    }
    await ctx.db.delete(args.id);
  },
});
