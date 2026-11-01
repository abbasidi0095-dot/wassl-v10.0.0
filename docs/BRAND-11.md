# Wassl 11 — Brand identity

**Direction:** Coastal Manifest — an Atlantic port authority's wayfinding system
crossed with a well-set market manifest.

**Signature palette**

| Token | Hex | Use |
|---|---|---|
| Atlantic Ink | `#153F37` | Primary brand, ink, app icon field |
| Limestone | `#F4F0E6` | Paper, reversed mark, text on ink |
| Signal Saffron | `#E6A23A` | Destination node, signal accents |

Secondary neutrals: `#5B6A63` muted ink, `#D9D0BF` line, `#0E2C26` deep ink.

## Monogram

A single continuous route draws a subtle W. The route starts with a solid
connection point on the left and ends at an open saffron destination ring on
the right. It is original vector artwork, not a delivery icon or an emoji.

- Minimum size: 24px.
- Clear space: at least 25% of the mark height on every side.
- Standard mark: Atlantic Ink route + Signal Saffron destination.
- Reversed mark: Limestone route + Signal Saffron destination.
- Monochrome mark: one colour via `currentColor`.

## Wordmarks

- Latin: Bricolage Grotesque, tight tracking, lowercase `assl`.
- Arabic: IBM Plex Sans Arabic, `وصّل`.
- Horizontal lockup: mark + Latin wordmark.
- Stacked lockup: mark + Latin + Arabic.
- Separate Latin and Arabic wordmarks are supplied for layouts that need only
  one script.

## Asset inventory

```
public/brand/wassl-monogram.svg
public/brand/wassl-monogram-reversed.svg
public/brand/wassl-monogram-mono.svg
public/brand/wassl-wordmark-latin.svg
public/brand/wassl-wordmark-arabic.svg
public/brand/wassl-lockup-horizontal.svg
public/brand/wassl-lockup-horizontal-reversed.svg
public/brand/wassl-lockup-stacked.svg
public/brand/wassl-icon.svg
public/brand/wassl-icon-maskable.svg

public/icon.svg
public/icon-32.png
public/icon-48.png
public/icon-192.png
public/icon-512.png
public/icon-maskable-512.png
public/apple-touch-icon.png
public/favicon-32.png

assets/icon-source.svg
assets/icon-foreground.svg
assets/icon-only.png
assets/icon-foreground.png
assets/icon-background.png
assets/splash-source.svg
assets/splash.png
```

Android mipmaps, iOS AppIcon/Splash and PWA icons were regenerated from these
sources with `npm run mobile:assets`. All exports are verified at 32px, 48px and
192px.

## Themes

Four complete palettes are driven by `data-theme` on `<html>`:

- **Coastal** — limestone paper, Atlantic ink, saffron signal.
- **Aero** — cool sea-glass paper, deep teal ink, cyan signal.
- **Midnight** — cold blue paper, navy ink, warm gold signal.
- **Sand** — warm dune paper, umber ink, terracotta signal.

Each theme has a full light and dark token set. Admin primary/accent colours,
logo upload and Arabic brand name still override the preset at runtime.

## Semantic tokens

The stylesheet exposes semantic tokens, not raw colour classes:

```
--paper, --surface, --surface-2
--ink, --on-ink, --muted
--line, --line-strong
--brand, --brand-deep, --brand-soft, --brand-ink
--signal, --signal-ink, --signal-soft
--danger, --danger-soft, --success, --success-soft
--glass-bg, --glass-strong, --glass-border, --glass-top, --glass-shadow
```

Components consume these through the Tailwind bridge (`bg-surface`, `text-ink`,
`border-line`, `bg-brand`, `text-signal-ink`, etc.).

## Contrast

Measured WCAG ratios:

- Atlantic Ink on Limestone: **10.26:1**
- Muted ink on Limestone: **5.01:1**
- Signal ink on Limestone: **5.20:1**
- Limestone on Atlantic Ink: **10.26:1**
- Dark ink on Midnight paper: **15.99:1**
- Muted dark text: **7.20:1**

Saffron is a signal fill and icon colour. It is **not** used for small text on
Limestone because it measures 1.92:1; text uses `--signal-ink`.

## Native and PWA

- PWA manifest theme: `#153F37`; background: `#F4F0E6`.
- Splash: Limestone field with the Atlantic Ink app icon.
- Capacitor splash and status bar: Limestone; status bar style `DARK` (dark
  icons on light).
- Dark status bar: `#0B1512`.
- Android `colors.xml` uses the signature palette.
