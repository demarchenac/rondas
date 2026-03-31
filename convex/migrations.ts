import { internalMutation } from './_generated/server';

/** Remove comma-separated segments already contained in a prior segment. */
function deduplicateAddress(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!kept.some((prev) => prev.toLowerCase().includes(lower))) {
      kept.push(part);
    }
  }
  return kept.join(', ');
}

/**
 * One-time migration: deduplicate addresses on existing bills.
 * Run from Convex dashboard: npx convex run migrations:deduplicateAddresses
 */
export const deduplicateAddresses = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query('bills').collect();
    let updated = 0;

    for (const bill of bills) {
      if (!bill.location?.address) continue;

      const cleaned = deduplicateAddress(bill.location.address);
      if (cleaned !== bill.location.address) {
        await ctx.db.patch(bill._id, {
          location: { ...bill.location, address: cleaned },
        });
        updated++;
      }
    }

    return { total: bills.length, updated };
  },
});
