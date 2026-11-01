import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Heart,
  RotateCcw,
  Sparkles,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { getTranslator } from "@/lib/i18n-server";
import type { HomeFeed, HomeFeedItem, HomeFeedSlot } from "@/lib/personalization";
import { ProductTile } from "./product-icon";
import { money } from "@/lib/utils";

const SLOT_KEYS: Record<HomeFeedSlot, string> = {
  breakfast: "Breakfast in {city}",
  lunch: "Lunch in {city}",
  afternoon: "An afternoon in {city}",
  dinner: "Dinner in {city}",
  late: "Open late in {city}",
  popular: "Popular in {city}",
};

const REASON_KEYS: Record<HomeFeedItem["reason"], string> = {
  reorder: "Order again",
  frequent: "Frequent",
  popular: "Popular",
  nearby: "Open nearby",
  favourite: "Favourite",
};

const REASON_ICONS: Record<HomeFeedItem["reason"], typeof Sparkles> = {
  reorder: RotateCcw,
  frequent: Star,
  popular: Sparkles,
  nearby: Clock3,
  favourite: Heart,
};

export async function HomeFeedSection({
  feed,
  cityLabel,
  citySlug,
}: {
  feed: HomeFeed;
  cityLabel: string;
  citySlug: string;
}) {
  const { t } = await getTranslator();
  if (!feed.items.length) return null;

  return (
    <section className="container-wassl mt-16 lg:mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">
            <Sparkles size={13} /> {t("For you")}
          </div>
          <h2 className="headline mt-2">
            {t(SLOT_KEYS[feed.slot], { city: cityLabel })}
          </h2>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-6 text-muted">
            {feed.personalized
              ? t(
                  "Based on your recent orders, favourites and what is open nearby.",
                )
              : t("Real orders and live availability from local stores.")}
          </p>
        </div>
        <Link href={`/search?city=${citySlug}`} className="btn btn-ghost btn-sm">
          {t("Search everything")}
          <ArrowRight size={13} className="rtl:-scale-x-100" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {feed.items.map((item) => (
          <HomeFeedCard key={`${item.kind}-${item.id}`} item={item} t={t} />
        ))}
      </div>

      {feed.promos.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {t("Offers for you")}
          </span>
          {feed.promos.map((promo) => (
            <span key={promo.code} className="inline-flex items-center gap-2 text-[12px]">
              <span className="rounded-[3px] border border-saffron/40 bg-saffron/10 px-2 py-1 font-semibold tracking-[0.04em] text-ink">
                {promo.code}
              </span>
              <span className="text-muted">{promo.label}</span>
            </span>
          ))}
          <span className="text-[11px] text-muted">
            {t("Use a code at checkout. Discounts are validated by the server.")}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function HomeFeedCard({
  item,
  t,
}: {
  item: HomeFeedItem;
  t: (text: string) => string;
}) {
  const ReasonIcon = REASON_ICONS[item.reason];
  return (
    <Link
      href={item.href}
      className="aero-tile group flex min-w-0 items-center gap-3 rounded-[10px] border p-3 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow)] motion-reduce:transform-none"
    >
      <span className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[7px] bg-surface-2">
        {item.kind === "product" ? (
          <ProductTile
            name={item.title}
            category={item.category ?? ""}
            image={item.image}
            className="h-full w-full"
            iconSize={22}
          />
        ) : item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="64px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <StoreIcon size={22} className="text-muted" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
          <ReasonIcon size={11} className="text-signal" />
          {t(REASON_KEYS[item.reason])}
        </span>
        <span className="mt-1 block truncate text-[14px] font-semibold group-hover:text-brand">
          {item.title}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          <span className="truncate">{item.subtitle}</span>
          {item.price !== undefined ? (
            <span className="ms-auto shrink-0 font-semibold text-ink tnum">
              {money(item.price)}
            </span>
          ) : null}
        </span>
      </span>

      <ArrowRight
        size={14}
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
      />
    </Link>
  );
}
