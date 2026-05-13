import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  billStateValidator,
  splitStrategyValidator,
  billItemValidator,
  billContactRefValidator,
  locationValidator,
  scanStatusValidator,
  scanResultValidator,
} from './validators';

export default defineSchema({
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    authProvider: v.optional(v.string()),
    config: v.optional(v.object({
      country: v.string(),
      usState: v.optional(v.string()),
      defaultTipPercent: v.number(),
      language: v.string(),
      theme: v.string(),
      extractPhotoTime: v.boolean(),
      useLocation: v.boolean(),
      impoconsumoIncluded: v.optional(v.boolean()),
      ivaIncluded: v.optional(v.boolean()),
    })),
    proOverride: v.optional(v.boolean()),
    proOverrideAt: v.optional(v.number()),
    totalBillsCreated: v.optional(v.number()),
  }).index('by_workos_id', ['workosId']),

  promoCodes: defineTable({
    code: v.string(),
    type: v.union(v.literal('lifetime'), v.literal('duration')),
    durationDays: v.optional(v.number()),
    maxUses: v.number(),
    uses: v.number(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_code', ['code']),

  bills: defineTable({
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    state: billStateValidator,
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    useCustomTip: v.optional(v.boolean()),
    items: v.array(billItemValidator),
    splitStrategy: v.optional(splitStrategyValidator),
    numPeople: v.optional(v.number()),
    contacts: v.array(billContactRefValidator),
    tagIds: v.optional(v.array(v.id('tags'))),
    country: v.optional(v.string()),
    taxIncludedOverride: v.optional(v.boolean()),
    decimalPlaces: v.optional(v.number()),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(locationValidator),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    // Denormalized fields for card rendering (computed in mutations)
    displayTotal: v.optional(v.number()),
    paidContactCount: v.optional(v.number()),
    assignedItemCount: v.optional(v.number()),
    totalContactCount: v.optional(v.number()),
    totalItemCount: v.optional(v.number()),
    progress: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_state', ['userId', 'state']),

  contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUri: v.optional(v.string()),
    isSelf: v.optional(v.boolean()),
    referenceCount: v.number(),
    lastReferencedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_phone', ['userId', 'phone']),

  tags: defineTable({
    userId: v.id('users'),
    name: v.string(),
    slug: v.optional(v.string()),
    color: v.string(),
    isPlatform: v.boolean(),
    sortOrder: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_slug', ['userId', 'slug']),

  scans: defineTable({
    userId: v.string(),
    status: scanStatusValidator,
    result: v.optional(scanResultValidator),
    error: v.optional(v.string()),
  }).index('by_user', ['userId']),
});
