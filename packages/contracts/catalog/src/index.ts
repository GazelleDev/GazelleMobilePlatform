import { z } from "zod";

export const menuItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  imageUrl: z.string().min(1).optional(),
  priceCents: z.number().int().nonnegative(),
  badgeCodes: z.array(z.string()),
  visible: z.boolean()
});

export const menuCategorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  items: z.array(menuItemSchema)
});

export const menuResponseSchema = z.object({
  locationId: z.string().min(1),
  currency: z.literal("USD"),
  categories: z.array(menuCategorySchema)
});

export const storeConfigResponseSchema = z.object({
  locationId: z.string().min(1),
  prepEtaMinutes: z.number().int().positive(),
  taxRateBasisPoints: z.number().int().min(0).max(10000),
  pickupInstructions: z.string()
});

export const catalogContract = {
  basePath: "/catalog",
  routes: {
    menu: {
      method: "GET",
      path: "/menu",
      request: z.undefined(),
      response: menuResponseSchema
    },
    storeConfig: {
      method: "GET",
      path: "/store/config",
      request: z.undefined(),
      response: storeConfigResponseSchema
    }
  }
} as const;
