import { ConvexError } from 'convex/values';
import type { QueryCtx, MutationCtx, ActionCtx } from '../_generated/server';

export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Not authenticated' });
  return identity.subject;
}
