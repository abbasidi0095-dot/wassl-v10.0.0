import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Clock3, ExternalLink, MapPin, Star, Truck } from "lucide-react";
import { getOpenState } from "@/lib/hours";
import { storePhoto } from "@/lib/store-images";
import type { Store } from "@/lib/types";
import { categoryLabel, money } from "@/lib/utils";

export function StoreCard({ store }: { store: Store }) {
  const hasRating = store.rating > 0 && store.reviews > 0;
  const openState = getOpenState(store);
  const mapsUrl =
    store.sourceUrl ||
    `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
  const tags = [...new Set([...(store.dietaryTags ?? []), ...(store.tags ?? [])])];

  return (
    <article className="card group relative flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_70px_-40px_rgba(15,60,58,.55)]">
      <Link
        href={`/store/${store.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`Browse ${store.name}`}
      />
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col">
        <div className="store-cover relative h-44">
          <Image
            src={storePhoto(store)}
            alt={`${store.name} storefront`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
            className="object-cover transition duration-500 ease-out group-hover:scale-[1.045]"
          />
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3.5">
            <span className="inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink/70 shadow-sm backdrop-blur">
              {categoryLabel(store.category)}
            </span>
            {hasRating ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-extrabold text-ink shadow-sm backdrop-blur">
                <Star size={10} className="fill-saffron text-saffron" />
                {store.rating.toFixed(1)}
              </span>
            ) : (
              <span className="rounded-full bg-white/95 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-teal shadow-sm backdrop-blur">
                New
              </span>
            )}
          </div>
          {store.dataOrigin === "marocapis" ? (
            <span className="absolute bottom-3 start-3.5 z-10 inline-flex items-center gap-1 rounded-full bg-ink/45 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-on-dark/90 backdrop-blur">
              <BadgeCheck size={9} /> Verified listing
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-extrabold tracking-[-0.03em]">
              {store.name}
            </h3>
            {store.nameAr ? (
              <p className="arabic mt-0.5 truncate text-[11px] text-ink/40">{store.nameAr}</p>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/50">{store.tagline}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide ${
                  store.dietaryTags?.includes(tag)
                    ? "bg-teal/10 text-teal"
                    : "bg-ink/4 text-ink/45"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-ink/50">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} className="text-teal" />
              {store.prepTime}–{store.prepTime + 10} min
            </span>
            <span className="inline-flex items-center gap-1">
              <Truck size={12} className="text-teal" />
              {money(store.deliveryFee)}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0 text-teal" />
              <span className="truncate">{store.landmark}</span>
            </span>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="pointer-events-auto inline-flex items-center gap-0.5 font-extrabold text-teal hover:underline"
              aria-label={`View ${store.name} on Google Maps`}
            >
              Map <ExternalLink size={9} />
            </a>
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-ink/5 pt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide ${
                openState.open ? "text-teal" : "text-red-500"
              }`}
              title={openState.detail}
            >
              <span className={`status-dot ${openState.open ? "live-dot" : ""}`} />
              {openState.open ? "Open now" : "Closed"}
            </span>
            <span className="text-[10px] font-bold text-ink/35">
              Min. {money(store.minOrder)}
              {hasRating ? ` · ${store.reviews.toLocaleString("en-US")} reviews` : ""}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
