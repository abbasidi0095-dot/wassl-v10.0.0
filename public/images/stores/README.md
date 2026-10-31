# Store photography

The images in this folder are the venue covers used across the storefront,
city pages and staff dashboards.

- **Source:** [Unsplash](https://unsplash.com) food and hospitality photography,
  downloaded at 900×640 and stored locally so the catalogue renders reliably
  offline and behind slow mobile connections.
- **License:** [Unsplash License](https://unsplash.com/license) — free to use,
  no attribution required. Credits are recorded here as a courtesy.
- **Assignments:** `src/lib/store-images.ts` maps every known storefront to a
  curated photo and provides deterministic category pools for stores created
  after launch.

Menu items intentionally use the Lucide icon system in
`src/components/product-icon.tsx` rather than photography, so every row keeps
the same visual rhythm.
