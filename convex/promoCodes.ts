import { mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { getAuthUserId } from './model/auth';

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export const redeemCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const workosId = await getAuthUserId(ctx);
    const normalized = normalizeCode(args.code);

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', workosId))
      .unique();

    if (!user) throw new ConvexError({ code: 'NOT_FOUND', message: 'user_not_found' });
    if (user.proOverride) throw new ConvexError({ code: 'ALREADY_PRO', message: 'already_pro' });

    const promoCode = await ctx.db
      .query('promoCodes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (!promoCode) throw new ConvexError({ code: 'INVALID_CODE', message: 'invalid_code' });

    if (promoCode.expiresAt && Date.now() > promoCode.expiresAt) {
      throw new ConvexError({ code: 'EXPIRED_CODE', message: 'expired_code' });
    }

    if (promoCode.maxUses !== 0 && promoCode.uses >= promoCode.maxUses) {
      throw new ConvexError({ code: 'LIMIT_REACHED', message: 'max_uses_reached' });
    }

    await ctx.db.patch(promoCode._id, { uses: promoCode.uses + 1 });
    await ctx.db.patch(user._id, {
      proOverride: true,
      proOverrideAt: Date.now(),
    });

    return { success: true, type: promoCode.type };
  },
});

export const createCode = mutation({
  args: {
    code: v.string(),
    type: v.union(v.literal('lifetime'), v.literal('duration')),
    durationDays: v.optional(v.number()),
    maxUses: v.number(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeCode(args.code);

    const existing = await ctx.db
      .query('promoCodes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (existing) throw new ConvexError({ code: 'DUPLICATE', message: 'code_already_exists' });

    return await ctx.db.insert('promoCodes', {
      code: normalized,
      type: args.type,
      durationDays: args.durationDays,
      maxUses: args.maxUses,
      uses: 0,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const getCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const normalized = normalizeCode(args.code);
    return await ctx.db
      .query('promoCodes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();
  },
});
