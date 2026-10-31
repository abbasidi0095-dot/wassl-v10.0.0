import {
  Beef,
  CakeSlice,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Flame,
  GlassWater,
  Hamburger,
  IceCreamCone,
  Milk,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";

type Tone = "coral" | "saffron" | "teal";

type Visual = {
  Icon: LucideIcon;
  tone: Tone;
  tile: string;
  ink: string;
};

const TONE: Record<Tone, { tile: string; ink: string }> = {
  coral: { tile: "bg-coral/10", ink: "text-coral" },
  saffron: { tile: "bg-saffron/20", ink: "text-saffron-deep" },
  teal: { tile: "bg-teal/10", ink: "text-teal" },
};

function visual(Icon: LucideIcon, tone: Tone): Visual {
  return { Icon, tone, ...TONE[tone] };
}

const RULES: Array<{ match: RegExp; visual: Visual }> = [
  { match: /burger|smash|hamburger/i, visual: visual(Hamburger, "coral") },
  { match: /pizza/i, visual: visual(Pizza, "coral") },
  { match: /wrap|sandwich|shawarma/i, visual: visual(Sandwich, "coral") },
  { match: /chicken|drumstick|wing/i, visual: visual(Drumstick, "coral") },
  { match: /kefta|merguez|lamb|beef|steak|ribs|chop|skewer|mixed grill/i, visual: visual(Beef, "coral") },
  { match: /tagine|couscous|harira|stew/i, visual: visual(Soup, "coral") },
  { match: /soup|broth/i, visual: visual(Soup, "saffron") },
  { match: /fish|bream|sole|calamari|squid|prawn|shrimp|oyster|seafood|salmon/i, visual: visual(Fish, "teal") },
  { match: /salad|zaalouk|vegetable|veggie|avocado|green/i, visual: visual(Salad, "teal") },
  { match: /fries|potato|onion ring/i, visual: visual(Flame, "coral") },
  { match: /msemen|bread|flatbread|khobz|toast/i, visual: visual(Wheat, "saffron") },
  { match: /crêpe|crepe|pancake/i, visual: visual(Croissant, "saffron") },
  { match: /cake|cheesecake|brownie|sellou|pastry|nata|dessert|sweet/i, visual: visual(CakeSlice, "saffron") },
  { match: /ice cream|icecream|gelato/i, visual: visual(IceCreamCone, "saffron") },
  { match: /cookie|biscuit/i, visual: visual(Cookie, "saffron") },
  { match: /espresso|latte|coffee|flat white|mocha/i, visual: visual(Coffee, "saffron") },
  { match: /tea|mint/i, visual: visual(Coffee, "teal") },
  { match: /milkshake|smoothie|milk/i, visual: visual(Milk, "saffron") },
  { match: /juice|orange|lemonade|citrus/i, visual: visual(CupSoda, "saffron") },
  { match: /water|soda|cola|drink|sparkling/i, visual: visual(GlassWater, "teal") },
  { match: /egg|breakfast/i, visual: visual(Egg, "saffron") },
];

const DEFAULT = visual(UtensilsCrossed, "teal");

/** Pick a consistent icon + tone for any menu item. */
export function productVisual(name: string, category?: string): Visual {
  const haystack = `${name} ${category ?? ""}`;
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.visual;
  }
  return DEFAULT;
}

export function ProductIcon({
  name,
  category,
  size = 20,
  className = "",
}: {
  name: string;
  category?: string;
  size?: number;
  className?: string;
}) {
  const { Icon, ink } = productVisual(name, category);
  return <Icon size={size} strokeWidth={1.75} className={`${ink} ${className}`} aria-hidden />;
}

/**
 * Tinted square used in menus, carts and receipts. Keeps every product row on
 * the same visual rhythm without resorting to emoji or mismatched stock photos.
 */
export function ProductTile({
  name,
  category,
  className = "h-10 w-10 rounded-xl",
  iconSize = 18,
}: {
  name: string;
  category?: string;
  className?: string;
  iconSize?: number;
}) {
  const { Icon, tile, ink } = productVisual(name, category);
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden ${tile} ${className}`}
      aria-hidden
    >
      <Icon size={iconSize} strokeWidth={1.7} className={ink} />
    </span>
  );
}
