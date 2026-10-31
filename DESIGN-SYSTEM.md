# Wassl design system — "Coastal Manifest"

The visual language for Wassl 10.x. It replaces the earlier soft/rounded/gradient
look with a disciplined, editorial system drawn from the product's own world: an
Atlantic port corridor, a paper manifest, wayfinding and live routes.

Status: implemented. Tokens live in `src/app/globals.css`; this file is the
reference for anyone extending the UI.

## 1. Design read

- **Product:** hyperlocal delivery, 24/7 grocery and taxi for the Moroccan South
  (Dakhla, Laâyoune, Boujdour, Esmara, Tarfaya).
- **Audience:** residents and families ordering on mid-range Android phones;
  shop owners and drivers working a shift; dispatch staff on desktop.
- **Register:** civic confidence, not startup cuteness. A port authority's
  wayfinding system crossed with a well-set market manifest: warm paper, deep
  ink, one signal colour, real photography, numbers that line up.
- **Not:** generic grocery green, neon dark mode, glass cards, gradient washes,
  emoji, three equal feature cards, pill-shaped everything.

## 2. Identity

| Element | Decision |
| --- | --- |
| Mark | A route "W" drawn as one stroke with a saffron destination dot. Square 4px-radius badge, never a glossy app icon. |
| Display face | **Bricolage Grotesque** (variable, 400–800). Headlines, store names, figures at display size. |
| Text face | **Instrument Sans** (variable, 400–700). UI, body, tables, labels. |
| Arabic face | **IBM Plex Sans Arabic** (400/500/600/700). Chosen for its clear Kufi-adjacent structure and technical tone. |
| Numerals | Tabular by default in data contexts (`.tnum`). Prices and counts never wobble. |
| Motif | The **route rule**: a dashed hairline that appears only on live tracking, delivery zones and the map. Never as decoration. |
| Photography | Real storefront and produce photography, documentary crop, no heavy dark gradient overlay. Crop anchors: centre-right for produce, centre for façades. |

Fonts are self-hosted in `public/fonts` (WOFF2) so the app works offline and in the
Capacitor shell. No runtime Google Fonts request.

## 3. Colour

Roles, not a swatch menu. Light is the default; dark mirrors the roles.

| Role | Light | Dark | Job |
| --- | --- | --- | --- |
| `--paper` | `#EFEDE8` | `#0A1211` | Page ground (limestone bone) |
| `--surface` | `#FAF9F6` | `#111B19` | Cards, fields, sheets |
| `--surface-2` | `#E9E1D2` | `#17231F` | Sunken bands, image placeholders |
| `--ink` | `#0C1A17` | `#E9F0EA` | Text, figures, primary button ground |
| `--muted` | `#5C6A64` | `#94A59E` | Secondary text |
| `--line` | `#DCD3C4` | `#243430` | Structure, table rules |
| `--brand` | `#0B4A45` | `#6FD8C9` | Primary action ground, active nav, live data |
| `--brand-ink` | `#F7F4EC` | `#06201D` | Text on brand |
| `--signal` | `#955B0B` | `#E9AE55` | "Now/live", priority and the single warm highlight |
| `--danger` | `#A63A22` | `#F08A72` | Destructive, out of stock, failed |
| `--success` | `#1E6B4F` | `#6FD3A8` | Completed, in stock |

Proportion: ground 75–85%, ink text, brand under 8%, signal under 3%. Colour is
carried by data and state, not by chrome.

## 4. Type scale

| Token | Size | Use |
| --- | --- | --- |
| `--text-xs` | 11–12px | metadata, table headers (sentence case); never below 11px |
| `--text-sm` | 14px | controls, dense lists |
| `--text-base` | 16px | body |
| `--text-lg` | 18px | lead paragraph |
| `--text-xl` | 22px | card titles |
| `--text-2xl` | `clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)` | section headings |
| `--text-display` | `clamp(2.6rem, 1.2rem + 5.6vw, 5.5rem)` | page heroes |

Rules: display is 600 weight with `-0.045em` tracking and `0.94` leading; body is
16px/1.6 with a 66ch measure; labels are sentence case at 12px (no tracked
uppercase kickers); the largest figure on a screen answers the screen's question.

## 5. Space, grid, radius, depth

- Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.
- Container: `min(1280px, 100% - 64px)`; 32px gutters desktop, 16px mobile.
- Grid: 12 columns, 24px gutters; customer pages use 7/5 and 8/4 splits, staff
  screens use a 232px rail + fluid canvas.
- Radius: 2 (tags), 6 (controls), 10 (panels), 16 (sheets), 999 only for status
  dots. No 24px on every surface.
- Depth: tone steps and 1px rules. Shadow only for the bottom sheet, sticky
  summary and the mobile tab bar.
- Images: 4:3 or 16:9 crops, 10px radius, no frame inside a frame.

## 6. Components

- **Button**: 44px tall, 6px radius, 600 weight. Primary = brand ground. Secondary
  = surface + line. Quiet = text + chevron. Destructive = danger on danger-soft.
- **Field**: 44px, surface ground, 1px line, 6px radius, 2px focus ring.
- **Panel**: surface + 1px line + 10px radius. Tables live inside panels without
  nested cards.
- **Tag**: 11px, sentence case, 4px radius, surface-2 ground.
- **Data row**: label left, tabular figure right, 1px rule only between rows.
- **Store row**: 16:10 photo, name, category, ETA, fee, status; no badges stacked
  over the photo except one status label.
- **Bottom tabs**: six destinations, 17px icons, 9px labels, 2px active rule.
- **Staff shell**: left rail (232px) with mark, workspace, nav and shift state;
  main canvas with a title row; on mobile the rail becomes a top bar + scrollable
  tab strip.

## 7. Motion

- One signature move: the route line draws (600ms) when live tracking mounts.
- Feedback only elsewhere: 120ms background/colour changes, 160ms sheet
  translate, `cubic-bezier(0.22, 1, 0.36, 1)`.
- No entrance animation on every section, no infinite pulse except the live dot,
  and `prefers-reduced-motion` removes all of it.

## 8. Accessibility

- WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and UI, measured on the rendered
  tokens.
- Visible `:focus-visible` everywhere (2px brand ring, 2px offset).
- Minimum 44×44 tap targets; the bottom tabs are 56px tall.
- State is never colour-only: every status has a word.
- Arabic uses the same tokens; layout uses logical properties (`ps/pe/ms/me`,
  `start/end`, `rtl:` variants).
- 320px is the minimum supported width; no horizontal scroll at 320px or 400%
  zoom.

## 9. Quality bar

Before shipping a screen: the screen's question is the biggest thing on it; every
block shares the container edges; no gradient wash, glass, emoji or decorative
kicker; numbers align; every empty/loading/error state exists; checked at 320,
390, 768 and 1440, light and dark, English and Arabic.
