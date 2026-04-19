import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export const redeemCode = mutation({
  args: {
    workosId: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeCode(args.code);

    const user = await ctx.db
      .query('users')
      .withIndex('by_workos_id', (q) => q.eq('workosId', args.workosId))
      .unique();

    if (!user) throw new Error('user_not_found');
    if (user.proOverride) throw new Error('already_pro');

    const promoCode = await ctx.db
      .query('promoCodes')
      .withIndex('by_code', (q) => q.eq('code', normalized))
      .unique();

    if (!promoCode) throw new Error('invalid_code');

    if (promoCode.expiresAt && Date.now() > promoCode.expiresAt) {
      throw new Error('expired_code');
    }

    if (promoCode.maxUses !== 0 && promoCode.uses >= promoCode.maxUses) {
      throw new Error('max_uses_reached');
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

    if (existing) throw new Error('code_already_exists');

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
