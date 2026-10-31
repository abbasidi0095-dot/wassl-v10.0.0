#!/usr/bin/env node
/**
 * Builds the locked restaurant snapshot used by the Wassl demo.
 *
 * Directory records come from MarocAPIs (real establishments in Southern
 * Morocco). Ratings, review counts, opening hours and street addresses are
 * enriched through SerpApi's Google Maps engine. Menus are authored demo
 * content in src/data/menu-catalog.ts; they are not scraped from anyone.
 *
 * Usage: node --env-file=.env.local scripts/import-restaurants.mjs
 *        node --env-file=.env.local scripts/import-restaurants.mjs --refresh
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const cacheDir = path.join(dataDir, "import-cache");
const outFile = path.join(root, "src", "data", "restaurants.locked.json");
const citiesFile = path.join(root, "src", "data", "cities.json");

const PRIORITY_CITIES = ["dakhla", "laayoune", "boujdour", "esmara", "tarfaya"];
const MAROCAPIS_KEY = process.env.MAROCAPIS_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_API_KEY;
const REFRESH = process.argv.includes("--refresh");

if (!MAROCAPIS_KEY) {
  console.error("MAROCAPIS_API_KEY is missing. Add it to .env.local.");
  process.exit(1);
}

const cities = JSON.parse(fs.readFileSync(citiesFile, "utf8"));
const cityBySlug = new Map(cities.map((city) => [city.slug, city]));

const CUISINES = [
  {
    id: "seafood",
    words: ["pescador", "poisson", "fish", "mer", "ocean", "océan", "courbine", "pecheur", "pêcheur", "calamar", "lagon"],
    tags: ["Seafood", "Grilled fish"],
    priceLevel: 3,
    emoji: "🐟",
    accent: "#0e7490",
    tagline: "The day's catch, grilled over charcoal",
    description:
      "A coastal kitchen working with the morning catch — grilled fish, chermoula and generous salads.",
  },
  {
    id: "cafe",
    words: ["cafe", "café", "coffee", "tea", "thé", "salon", "patisserie", "pâtisserie", "crepe", "crêpe"],
    tags: ["Café", "Breakfast"],
    priceLevel: 2,
    emoji: "☕",
    accent: "#0f766e",
    tagline: "Coffee, breakfast and something sweet",
    description:
      "A neighbourhood café for slow mornings: mint tea, msemen, espresso and fresh pastries.",
  },
  {
    id: "fastfood",
    words: ["burger", "snack", "fast", "pizza", "tacos", "kebab", "chicken", "poulet"],
    tags: ["Fast food", "Late night"],
    priceLevel: 1,
    emoji: "🍔",
    accent: "#b45309",
    tagline: "Hot, fast and open late",
    description:
      "Burgers, loaded fries and cold drinks, made to order and packed for the road.",
  },
  {
    id: "grill",
    words: ["grill", "braise", "mechoui", "méchoui", "bbq", "barbecue", "broche"],
    tags: ["Grill", "Family"],
    priceLevel: 2,
    emoji: "🍢",
    accent: "#c2410c",
    tagline: "Charcoal grill and family plates",
    description:
      "Skewers, kefta and grilled chicken straight off the coals, with bread and tea.",
  },
  {
    id: "moroccan",
    words: [],
    tags: ["Moroccan", "Family"],
    priceLevel: 2,
    emoji: "🍲",
    accent: "#9a3412",
    tagline: "Slow-cooked Moroccan plates",
    description:
      "Tagines, couscous and home-style cooking, prepared in the traditional way.",
  },
];

function cuisineFor(name) {
  const lower = name.toLowerCase();
  for (const cuisine of CUISINES) {
    if (cuisine.words.some((word) => lower.includes(word))) return cuisine;
  }
  return CUISINES[CUISINES.length - 1];
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function shortHash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 6);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(restaurants) {
  return crypto.createHash("sha256").update(canonical(restaurants)).digest("hex");
}

function haversine(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function parseClock(value) {
  const match = String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABEL = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function normalizeHours(rawHours) {
  if (!Array.isArray(rawHours) || !rawHours.length) return [];
  const byRange = new Map();
  for (const day of DAY_ORDER) {
    const entry = rawHours.find((item) => item[day]);
    const value = entry?.[day];
    if (!value) continue;
    const [openRaw, closeRaw] = value.split(/\s*[–-]\s*/);
    const open = parseClock(openRaw);
    const close = parseClock(closeRaw);
    if (!open || !close) continue;
    const key = `${open}|${close}`;
    const days = byRange.get(key) || [];
    days.push(DAY_LABEL[day]);
    byRange.set(key, days);
  }
  return Array.from(byRange.entries()).map(([key, days]) => {
    const [open, close] = key.split("|");
    return { days: days.join("–"), open, close };
  });
}

async function getJson(url, label, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  });
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchMarocApisRestaurants(citySlug) {
  const cacheFile = path.join(cacheDir, `marocapis-${citySlug}.json`);
  if (!REFRESH && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }
  const url = new URL("https://api.marocapis.com/api/v1/restaurants");
  url.searchParams.set("city", citySlug);
  url.searchParams.set("limit", "50");
  const json = await getJson(url, `MarocAPIs ${citySlug}`, {
    "X-API-Key": MAROCAPIS_KEY,
  });
  const items = json?.data?.items ?? [];
  fs.writeFileSync(cacheFile, JSON.stringify(items, null, 2));
  return items;
}

async function enrichWithSerpApi(name, cityName) {
  const key = `${slugify(name)}-${slugify(cityName)}`;
  const cacheFile = path.join(cacheDir, `serp-${key}.json`);
  if (!REFRESH && fs.existsSync(cacheFile)) {
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  }
  if (!SERPAPI_KEY) return null;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("type", "search");
  url.searchParams.set("q", `${name} ${cityName} Morocco`);
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", SERPAPI_KEY);
  try {
    const json = await getJson(url, `SerpApi ${name}`);
    const place =
      json?.place_results ||
      (json?.local_results ?? []).find(
        (item) =>
          slugify(item.title || "").includes(slugify(name).split("-")[0]) ||
          slugify(name).includes(slugify(item.title || "").split("-")[0]),
      ) ||
      (json?.local_results ?? [])[0] ||
      null;
    fs.writeFileSync(cacheFile, JSON.stringify(place, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 350));
    return place;
  } catch (error) {
    console.warn(`  ! SerpApi ${name}: ${error.message}`);
    fs.writeFileSync(cacheFile, "null");
    return null;
  }
}

function money(value) {
  return Math.round(value);
}

function seedNumber(value, min, max) {
  const hash = parseInt(crypto.createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
  return min + (hash % (max - min + 1));
}

async function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const restaurants = [];
  const seen = new Set();

  for (const citySlug of PRIORITY_CITIES) {
    const city = cityBySlug.get(citySlug);
    if (!city) {
      console.warn(`Unknown city ${citySlug}, skipping`);
      continue;
    }
    console.log(`\n${city.name} (${citySlug})`);
    let places = [];
    try {
      places = await fetchMarocApisRestaurants(citySlug);
    } catch (error) {
      console.warn(`  ! ${error.message}`);
      continue;
    }
    console.log(`  ${places.length} establishment(s)`);

    for (const place of places) {
      const name = place.name?.en || place.name?.fr || place.name?.ar;
      if (!name) continue;
      const id = slugify(name);
      if (seen.has(id)) continue;
      seen.add(id);

      const cuisine = cuisineFor(name);
      const marocLat = place.coordinates?.latitude;
      const marocLng = place.coordinates?.longitude;
      const enriched = await enrichWithSerpApi(name, city.name);

      const serpLat = enriched?.gps_coordinates?.latitude;
      const serpLng = enriched?.gps_coordinates?.longitude;
      const hasSerpCoords = Number.isFinite(serpLat) && Number.isFinite(serpLng);
      const serpDistance = hasSerpCoords
        ? haversine({ lat: serpLat, lng: serpLng }, { lat: city.lat, lng: city.lng })
        : Infinity;
      const marocDistance = Number.isFinite(marocLat)
        ? haversine({ lat: marocLat, lng: marocLng }, { lat: city.lat, lng: city.lng })
        : Infinity;

      // A Google Maps hit farther than 30 km from the city centre is almost
      // always a same-name place in another town. Drop the enrichment rather
      // than attribute another restaurant's rating to this one.
      const trustedEnrichment = serpDistance <= 30;
      const usableDirectoryCoords = marocDistance <= 30;

      if (!trustedEnrichment && !usableDirectoryCoords) {
        console.warn(
          `  × ${name}: no verified coordinates within 30 km of ${city.name}; skipped`,
        );
        continue;
      }

      const lat = trustedEnrichment ? serpLat : marocLat;
      const lng = trustedEnrichment ? serpLng : marocLng;

      if (!trustedEnrichment) {
        console.warn(
          `  ! ${name}: directory record kept, Google enrichment discarded (${serpDistance.toFixed(0)} km away)`,
        );
      }

      const hours = trustedEnrichment ? normalizeHours(enriched?.hours) : [];
      const rating = trustedEnrichment ? Number(enriched?.rating ?? 0) : 0;
      const reviews = trustedEnrichment ? Number(enriched?.reviews ?? 0) : 0;
      const address =
        (trustedEnrichment ? enriched?.address : undefined) ||
        `${city.name} — location from the MarocAPIs directory`;

      restaurants.push({
        externalId: place.id,
        slug: `${id}-${shortHash(place.id)}`,
        name,
        nameAr: place.name?.ar || "",
        citySlug,
        category: "restaurant",
        cuisine: cuisine.id,
        lat,
        lng,
        address,
        phone: trustedEnrichment ? enriched?.phone || "" : "",
        rating,
        reviews,
        priceLevel: cuisine.priceLevel,
        tags: cuisine.tags,
        emoji: cuisine.emoji,
        accent: cuisine.accent,
        tagline: cuisine.tagline,
        description: cuisine.description,
        openingHours: hours,
        distanceFromCentreKm: Number(haversine({ lat, lng }, { lat: city.lat, lng: city.lng }).toFixed(1)),
        coordinateVerified: true,
        source: "marocapis",
        enrichedBy: trustedEnrichment ? "serpapi" : "marocapis",
        sourceUrl:
          trustedEnrichment && enriched?.place_id
            ? `https://www.google.com/maps/place/?q=place_id:${enriched.place_id}`
            : null,
        minOrder: money(seedNumber(`${place.id}-min`, 20, 50) / 5) * 5,
        deliveryFee: seedNumber(`${place.id}-fee`, 8, 14),
        prepTime: seedNumber(`${place.id}-prep`, 18, 34),
        verifiedAt: new Date().toISOString(),
      });
      console.log(
        `  · ${name} — ${
          trustedEnrichment ? `⭐ ${rating || "new"} (${reviews})` : "directory only"
        }`,
      );
    }
  }

  const payload = {
    version: 1,
    locked: true,
    generatedAt: new Date().toISOString(),
    citySlugs: PRIORITY_CITIES,
    sources: [
      {
        id: "marocapis",
        name: "Maroc APIs",
        url: "https://marocapis.com",
        role: "Establishment directory (name, city, coordinates)",
        license: "Commercial API — data used under the operator's key",
      },
      {
        id: "serpapi",
        name: "SerpApi — Google Maps",
        url: "https://serpapi.com",
        role: "Rating, review count, opening hours, street address",
        license: "Commercial API — cached snapshot for demo use",
      },
    ],
    notice:
      "Establishment records are real. Menus, prices and product photography are authored demo content and are locked against runtime edits.",
    checksum: checksum(restaurants),
    restaurants,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${restaurants.length} restaurants to ${outFile}`);
  console.log(`Checksum ${payload.checksum}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
