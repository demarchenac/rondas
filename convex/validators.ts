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

export const billItemValidator = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  subtotal: v.number(),
});

export const contactItemRefValidator = v.object({
  itemId: v.string(),
  units: v.number(),
});

export const billContactRefValidator = v.object({
  contactId: v.id('contacts'),
  isSelf: v.optional(v.boolean()),
  items: v.array(contactItemRefValidator),
  amount: v.number(),
  paid: v.boolean(),
});

export const contactGroupValidator = v.object({
  id: v.string(),
  contactIds: v.array(v.id('contacts')),
  name: v.string(),
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
  decimalPlaces: v.optional(v.number()),
});

export const contactArgValidator = v.object({
  name: v.string(),
  phone: v.optional(v.string()),
  isSelf: v.optional(v.boolean()),
  imageUri: v.optional(v.string()),
});
