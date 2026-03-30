import { v } from 'convex/values';

export const billStateValidator = v.union(
  v.literal('draft'),
  v.literal('unsplit'),
  v.literal('split'),
  v.literal('unresolved')
);

export const splitStrategyValidator = v.union(
  v.literal('equal'),
  v.literal('by_item')
);

export const categoryValidator = v.union(
  v.literal('dining'),
  v.literal('retail'),
  v.literal('service')
);

export const billItemValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  subtotal: v.number(),
});

export const billContactRefValidator = v.object({
  contactId: v.id('contacts'),
  items: v.array(v.string()),
  amount: v.number(),
  paid: v.boolean(),
});

export const locationValidator = v.object({
  latitude: v.number(),
  longitude: v.number(),
  address: v.optional(v.string()),
});

export const scanStatusValidator = v.union(
  v.literal('analyzing'),
  v.literal('thinking'),
  v.literal('extracting'),
  v.literal('complete'),
  v.literal('error')
);

export const scanResultValidator = v.object({
  category: v.string(),
  items: v.array(v.object({
    name: v.string(),
    quantity: v.number(),
    unitPrice: v.number(),
    subtotal: v.number(),
  })),
  tax: v.number(),
  tip: v.number(),
  total: v.number(),
});

export const contactArgValidator = v.object({
  name: v.string(),
  phone: v.string(),
  imageUri: v.optional(v.string()),
});
