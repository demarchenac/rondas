import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const billState = v.union(
  v.literal('unsplit'),
  v.literal('split'),
  v.literal('unresolved')
);

const splitStrategy = v.union(
  v.literal('equal'),
  v.literal('by_item')
);

const billItem = v.object({
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  subtotal: v.number(),
});

const billContact = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  items: v.array(v.number()), // indices into items array
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
  })
    .index('by_user', ['userId'])
    .index('by_user_state', ['userId', 'state']),
});
