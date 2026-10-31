import type { Store, StoreCategory } from "./types";

/**
 * Venue photography lives in `public/images/stores`. Every seeded and imported
 * storefront gets a curated photo so the catalogue never falls back to an
 * emoji tile. New stores created at runtime hash into a category pool.
 */

const BASE = "/images/stores";

/** Hand-picked cover photos, one per known storefront. */
const STORE_PHOTOS: Record<string, string> = {
  // Seeded demo stores
  "dakhla-grill": "grill-8.jpg",
  "ocean-cafe": "cafe-2.jpg",
  "sahara-market": "grocery-1.jpg",
  "laayoune-burger": "grill-4.jpg",
  "pharmacie-al-wafa": "pharmacy-2.jpg",
  "boujdour-fresh": "grocery-3.jpg",
  "smara-kitchen": "tagine-2.jpg",
  "tarfaya-tea-house": "cafe-4.jpg",

  // Imported establishments — seafood
  "pescador-0a26a9": "seafood-4.jpg",
  "la-courbine-d174df": "seafood-1.jpg",

  // Imported establishments — fast food
  "snack-restau-al-akhawayne-47d967": "fastfood-1.jpg",
  "snack-med-38cdb9": "fastfood-3.jpg",
  "snack-bahja-f1066b": "fastfood-2.jpg",

  // Imported establishments — cafés
  "cafe-restaurant-158b30": "cafe-1.jpg",
  "la-maison-du-the-d8ae79": "cafe-5.jpg",

  // Imported establishments — Moroccan kitchens
  "samarkand-265c27": "moroccan-2.jpg",
  "polpo-300901": "moroccan-4.jpg",
  "teranga-80bc9d": "bowl-1.jpg",
  "gladys-07f91f": "dining-1.jpg",
  "echarfaa-food-cdcb8e": "moroccan-5.jpg",
  "chiringuito-cabana-e4f9e4": "terrace-1.jpg",
  "restaurant-madak-f10a67": "interior-1.jpg",
  "talha-mar-ed67e9": "seafood-3.jpg",
  "relax-3202a5": "interior-2.jpg",
  "kaiser-wilhelm-d4f40d": "interior-3.jpg",
  "chez-rahim-66e9d3": "moroccan-3.jpg",
  "casa-lola-79e5d1": "salad-1.jpg",
  "casa-luis-20cbe3": "plates-1.jpg",
  "bahia-7b07ca": "moroccan-1.jpg",
  "mad-camel-760edb": "couscous-1.jpg",
  "flaman-rose-42a50f": "moroccan-7.jpg",
  "diamant-du-sahara-6ac893": "moroccan-8.jpg",
  "villa-dakhla-4d8580": "moroccan-10.jpg",
  "lagune-food-1d73a1": "moroccan-11.jpg",
  "chtokan-5b23c8": "steak-1.jpg",
  "xhiwat-bladi-restaurant-7180fa": "ribs-1.jpg",
  "food-lounge-qwiindy-55db16": "interior-4.jpg",
  "restaurante-beauport-ea0c73": "moroccan-9.jpg",
  "ville-des-roses-6b121d": "moroccan-6.jpg",
  "gout-de-fes-9713ea": "tagine-1.jpg",
  "lameniar-f29423": "breakfast-1.jpg",
  "errachidiya-ec65f9": "bakery-1.jpg",
  "le-delice-f45046": "bakery-4.jpg",
};

/** Category pools for stores provisioned after launch. */
const CATEGORY_POOL: Record<StoreCategory, string[]> = {
  restaurant: [
    "moroccan-2.jpg",
    "moroccan-4.jpg",
    "moroccan-5.jpg",
    "tagine-1.jpg",
    "tagine-2.jpg",
    "grill-8.jpg",
    "plates-1.jpg",
    "interior-1.jpg",
    "interior-2.jpg",
    "interior-3.jpg",
    "interior-4.jpg",
    "dining-1.jpg",
    "couscous-1.jpg",
    "steak-1.jpg",
  ],
  cafe: ["cafe-1.jpg", "cafe-2.jpg", "cafe-3.jpg", "cafe-5.jpg", "bakery-3.jpg", "bakery-5.jpg"],
  grocery: ["grocery-1.jpg", "grocery-2.jpg", "grocery-3.jpg", "grocery-4.jpg"],
  pharmacy: ["pharmacy-1.jpg", "pharmacy-2.jpg", "pharmacy-3.jpg", "pharmacy-4.jpg"],
  gifts: ["bakery-2.jpg", "bakery-4.jpg", "bakery-5.jpg", "cafe-3.jpg"],
};

function fingerprint(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** Resolve a storefront cover photo. Always returns a local image path. */
export function storePhoto(store: Pick<Store, "slug" | "category">): string {
  const curated = STORE_PHOTOS[store.slug];
  if (curated) return `${BASE}/${curated}`;
  const pool = CATEGORY_POOL[store.category] ?? CATEGORY_POOL.restaurant;
  return `${BASE}/${pool[fingerprint(store.slug) % pool.length]}`;
}

export function storePhotoAlt(store: Pick<Store, "name">): string {
  return `${store.name} storefront`;
}
