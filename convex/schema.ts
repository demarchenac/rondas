import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const billState = v.union(
  v.literal('draft'),
  v.literal('unsplit'),
  v.literal('split'),
  v.literal('unresolved')
);

const splitStrategy = v.union(
  v.literal('equal'),
  v.literal('by_item')
);

const billItem = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  subtotal: v.number(),
});

const billContact = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  imageUri: v.optional(v.string()),
  items: v.array(v.string()), // item IDs
  amount: v.number(),
  paid: v.boolean(),
});

export default defineSchema({
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  }).index('by_workos_id', ['workosId']),

  bills: defineTable({
    userId: v.string(), // workosId of the bill owner
    name: v.string(),
    imageUrl: v.optional(v.string()),
    state: billState,
    total: v.number(),
    tax: v.optional(v.number()),
    tip: v.optional(v.number()),
    items: v.array(billItem),
    splitStrategy: v.optional(splitStrategy),
    contacts: v.array(billContact),
    category: v.optional(v.union(v.literal('dining'), v.literal('retail'), v.literal('service'))),
    country: v.optional(v.string()),
    photoTakenAt: v.optional(v.string()),
    location: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
      address: v.optional(v.string()),
    })),
  })
    .index('by_user', ['userId'])
    .index('by_user_state', ['userId', 'state']),
});
