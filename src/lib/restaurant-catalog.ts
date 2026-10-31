import snapshotJson from "@/data/restaurants.locked.json";
import { MENUS, MODIFIER_SETS } from "@/data/menu-catalog";
import type { Product, Store } from "./types";
import type { RestaurantRecord } from "./data-source/types";

const snapshot = snapshotJson as unknown as { restaurants: RestaurantRecord[] };

function menuFor(restaurant: RestaurantRecord) {
  return MENUS[restaurant.cuisine] ?? MENUS.moroccan;
}

/**
 * Expands the locked snapshot into storefronts and menu lines. Imported
 * records are read-only: `locked` is carried onto every product so the UI can
 * label the menu and mutations can refuse to touch it.
 */
export function buildImportedRestaurants(): {
  stores: Store[];
  products: Product[];
} {
  const stores: Store[] = [];
  const products: Product[] = [];

  for (const restaurant of snapshot.restaurants) {
    stores.push({
      id: `store_${restaurant.slug}`,
      slug: restaurant.slug,
      name: restaurant.name,
      nameAr: restaurant.nameAr,
      citySlug: restaurant.citySlug,
      category: "restaurant",
      tagline: restaurant.tagline,
      description: restaurant.description,
      address: restaurant.address,
      landmark: restaurant.address.split(",")[0]?.trim() || restaurant.address,
      lat: restaurant.lat,
      lng: restaurant.lng,
      accent: restaurant.accent,
      rating: restaurant.rating,
      reviews: restaurant.reviews,
      prepTime: restaurant.prepTime,
      minOrder: restaurant.minOrder,
      deliveryFee: restaurant.deliveryFee,
      isOpen: true,
      commissionRate: 12,
      phone: restaurant.phone,
      ownerName: "Verified partner",
      dataOrigin: "marocapis",
      externalId: restaurant.externalId,
      locked: true,
      priceLevel: restaurant.priceLevel,
      tags: restaurant.tags,
      openingHours: restaurant.openingHours,
      coordinateVerified: restaurant.coordinateVerified,
      verifiedAt: restaurant.verifiedAt,
      sourceUrl: restaurant.sourceUrl,
    });

    menuFor(restaurant).forEach((template, index) => {
      products.push({
        id: `product_${restaurant.slug}_${index}`,
        storeId: `store_${restaurant.slug}`,
        category: template.category,
        name: template.name,
        description: template.description,
        price: template.price,
        emoji: template.emoji,
        available: true,
        popular: template.popular,
        tags: template.tags,
        calories: template.calories,
        locked: true,
        modifiers: template.modifiers
          ? structuredClone(MODIFIER_SETS[template.modifiers] ?? [])
          : undefined,
      });
    });
  }

  return { stores, products };
}

export function importedRestaurantCount() {
  return snapshot.restaurants.length;
}
