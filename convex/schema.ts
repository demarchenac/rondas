import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
  billStateValidator,
  splitStrategyValidator,
  categoryValidator,
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
    config: v.optional(v.object({
      country: v.string(),
      usState: v.optional(v.string()),
      defaultTipPercent: v.number(),
      language: v.string(),
      theme: v.string(),
      extractPhotoTime: v.boolean(),
      useLocation: v.boolean(),
    })),
  }).index('by_workos_id', ['workosId']),

  bills: defineTable({
    userId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    state: billStateValidator,
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    tipPercent: v.optional(v.number()),
    items: v.array(billItemValidator),
    splitStrategy: v.optional(splitStrategyValidator),
    contacts: v.array(billContactRefValidator),
    category: v.optional(categoryValidator),
    country: v.optional(v.string()),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(locationValidator),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_user_state', ['userId', 'state']),

  contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    imageUri: v.optional(v.string()),
    referenceCount: v.number(),
    lastReferencedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_phone', ['userId', 'phone']),

  scans: defineTable({
    userId: v.string(),
    status: scanStatusValidator,
    result: v.optional(scanResultValidator),
    error: v.optional(v.string()),
  }).index('by_user', ['userId']),
});
