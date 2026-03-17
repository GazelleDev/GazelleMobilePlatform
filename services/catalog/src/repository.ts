import type { FastifyBaseLogger } from "fastify";
import {
  menuItemCustomizationGroupSchema,
  menuItemSchema,
  menuResponseSchema,
  storeConfigResponseSchema
} from "@gazelle/contracts-catalog";
import { createPostgresDb, ensurePersistenceTables, getDatabaseUrl, type PersistenceDb } from "@gazelle/persistence";
import { z } from "zod";

const defaultLocationId = "flagship-01";

const espressoCustomizationGroups = [
  {
    id: "size",
    label: "Size",
    description: "Choose the cup that fits the order.",
    selectionType: "single" as const,
    required: true,
    options: [
      { id: "regular", label: "Regular", priceDeltaCents: 0, default: true },
      { id: "large", label: "Large", priceDeltaCents: 100 }
    ]
  },
  {
    id: "milk",
    label: "Milk",
    description: "Keep it classic or switch the texture.",
    selectionType: "single" as const,
    required: true,
    options: [
      { id: "whole", label: "Whole milk", priceDeltaCents: 0, default: true },
      { id: "oat", label: "Oat milk", priceDeltaCents: 75 },
      { id: "almond", label: "Almond milk", priceDeltaCents: 75 }
    ]
  },
  {
    id: "extra-shot",
    label: "Extra shot",
    description: "Add an additional espresso pull when you want more structure.",
    selectionType: "boolean" as const,
    options: [{ id: "extra-shot", label: "Add shot", priceDeltaCents: 125 }]
  }
];

const coldBrewCustomizationGroups = [
  {
    id: "size",
    label: "Size",
    description: "Choose the pour size for this drink.",
    selectionType: "single" as const,
    required: true,
    options: [
      { id: "regular", label: "Regular", priceDeltaCents: 0, default: true },
      { id: "large", label: "Large", priceDeltaCents: 75 }
    ]
  }
];

const defaultMenuPayload = menuResponseSchema.parse({
  locationId: defaultLocationId,
  currency: "USD",
  categories: [
    {
      id: "espresso",
      title: "Espresso Bar",
      items: [
        {
          id: "cortado",
          name: "Cortado",
          description: "Double espresso cut with steamed milk.",
          priceCents: 475,
          badgeCodes: ["new"],
          visible: true,
          customizationGroups: espressoCustomizationGroups
        },
        {
          id: "flat-white",
          name: "Flat White",
          description: "Silky microfoam over ristretto shots.",
          priceCents: 525,
          badgeCodes: ["popular"],
          visible: true,
          customizationGroups: espressoCustomizationGroups
        }
      ]
    },
    {
      id: "cold",
      title: "Cold Drinks",
      items: [
        {
          id: "flash-brew",
          name: "Flash Brew",
          description: "Single-origin coffee brewed hot and chilled over ice.",
          priceCents: 495,
          badgeCodes: [],
          visible: true,
          customizationGroups: coldBrewCustomizationGroups
        },
        {
          id: "seasonal-tonic",
          name: "Seasonal Espresso Tonic",
          description: "House tonic with citrus and espresso.",
          priceCents: 575,
          badgeCodes: ["seasonal"],
          visible: false
        }
      ]
    }
  ]
});

const defaultStoreConfigPayload = storeConfigResponseSchema.parse({
  locationId: defaultLocationId,
  prepEtaMinutes: 12,
  taxRateBasisPoints: 600,
  pickupInstructions: "Pickup at the flagship order counter."
});

type MenuResponse = z.output<typeof menuResponseSchema>;
type StoreConfigResponse = z.output<typeof storeConfigResponseSchema>;
type MenuItem = z.output<typeof menuItemSchema>;

type CatalogRepository = {
  backend: "memory" | "postgres";
  getMenu(): Promise<MenuResponse>;
  getStoreConfig(): Promise<StoreConfigResponse>;
  close(): Promise<void>;
};

function parseJsonValue<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const parsedValue = typeof value === "string" ? JSON.parse(value) : value;
  return schema.parse(parsedValue);
}

function toBadgeCodes(value: unknown) {
  return parseJsonValue(z.array(z.string()), value);
}

function toCustomizationGroups(value: unknown) {
  return parseJsonValue(z.array(menuItemCustomizationGroupSchema), value);
}

function createInMemoryRepository(): CatalogRepository {
  return {
    backend: "memory",
    async getMenu() {
      return defaultMenuPayload;
    },
    async getStoreConfig() {
      return defaultStoreConfigPayload;
    },
    async close() {
      // no-op
    }
  };
}

async function seedCatalogDefaults(db: PersistenceDb) {
  const existingCategory = await db
    .selectFrom("catalog_menu_categories")
    .select("category_id")
    .where("location_id", "=", defaultMenuPayload.locationId)
    .executeTakeFirst();

  if (!existingCategory) {
    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto("catalog_menu_categories")
        .values(
          defaultMenuPayload.categories.map((category, index) => ({
            location_id: defaultMenuPayload.locationId,
            category_id: category.id,
            title: category.title,
            sort_order: index
          }))
        )
        .onConflict((oc) => oc.columns(["location_id", "category_id"]).doNothing())
        .execute();

      await trx
        .insertInto("catalog_menu_items")
        .values(
          defaultMenuPayload.categories.flatMap((category) =>
            category.items.map((item, index) => ({
              location_id: defaultMenuPayload.locationId,
              item_id: item.id,
              category_id: category.id,
              name: item.name,
              description: item.description,
              image_url: item.imageUrl ?? null,
              price_cents: item.priceCents,
              badge_codes_json: JSON.stringify(item.badgeCodes),
              customization_groups_json: JSON.stringify(item.customizationGroups ?? []),
              visible: item.visible,
              sort_order: index
            }))
          )
        )
        .onConflict((oc) => oc.columns(["location_id", "item_id"]).doNothing())
        .execute();
    });
  }

  await db
    .insertInto("catalog_store_configs")
    .values({
      location_id: defaultStoreConfigPayload.locationId,
      prep_eta_minutes: defaultStoreConfigPayload.prepEtaMinutes,
      tax_rate_basis_points: defaultStoreConfigPayload.taxRateBasisPoints,
      pickup_instructions: defaultStoreConfigPayload.pickupInstructions
    })
    .onConflict((oc) => oc.column("location_id").doNothing())
    .execute();
}

async function createPostgresRepository(connectionString: string): Promise<CatalogRepository> {
  const db = createPostgresDb(connectionString);
  await ensurePersistenceTables(db);
  await seedCatalogDefaults(db);

  return {
    backend: "postgres",
    async getMenu() {
      const categories = await db
        .selectFrom("catalog_menu_categories")
        .selectAll()
        .where("location_id", "=", defaultMenuPayload.locationId)
        .orderBy("sort_order", "asc")
        .execute();

      if (categories.length === 0) {
        return defaultMenuPayload;
      }

      const items = await db
        .selectFrom("catalog_menu_items")
        .selectAll()
        .where("location_id", "=", defaultMenuPayload.locationId)
        .orderBy("category_id", "asc")
        .orderBy("sort_order", "asc")
        .execute();

      const itemsByCategory = new Map<string, MenuItem[]>();
      for (const item of items) {
        const existing = itemsByCategory.get(item.category_id) ?? [];
        existing.push({
          id: item.item_id,
          name: item.name,
          description: item.description,
          imageUrl: item.image_url ?? undefined,
          priceCents: item.price_cents,
          badgeCodes: toBadgeCodes(item.badge_codes_json),
          visible: item.visible,
          customizationGroups: toCustomizationGroups(item.customization_groups_json)
        });
        itemsByCategory.set(item.category_id, existing);
      }

      return menuResponseSchema.parse({
        locationId: defaultMenuPayload.locationId,
        currency: defaultMenuPayload.currency,
        categories: categories.map((category) => ({
          id: category.category_id,
          title: category.title,
          items: itemsByCategory.get(category.category_id) ?? []
        }))
      });
    },
    async getStoreConfig() {
      const row = await db
        .selectFrom("catalog_store_configs")
        .selectAll()
        .where("location_id", "=", defaultStoreConfigPayload.locationId)
        .executeTakeFirst();

      if (!row) {
        return defaultStoreConfigPayload;
      }

      return storeConfigResponseSchema.parse({
        locationId: row.location_id,
        prepEtaMinutes: row.prep_eta_minutes,
        taxRateBasisPoints: row.tax_rate_basis_points,
        pickupInstructions: row.pickup_instructions
      });
    },
    async close() {
      await db.destroy();
    }
  };
}

export async function createCatalogRepository(logger: FastifyBaseLogger): Promise<CatalogRepository> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    logger.info({ backend: "memory" }, "catalog persistence backend selected");
    return createInMemoryRepository();
  }

  try {
    const repository = await createPostgresRepository(databaseUrl);
    logger.info({ backend: "postgres" }, "catalog persistence backend selected");
    return repository;
  } catch (error) {
    logger.error({ error }, "failed to initialize postgres persistence; falling back to in-memory");
    return createInMemoryRepository();
  }
}

export type { CatalogRepository };
