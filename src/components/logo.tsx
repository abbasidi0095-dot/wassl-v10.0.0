"use client";

import Link from "next/link";
import { useBrand } from "./brand-provider";

/**
 * The Wassl mark: one route stroke that forms a W, ending at a saffron
 * destination dot. Drawn rather than illustrated so it stays sharp at 16px.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M9 18.5 21.5 47 32 28.5 42.5 47 55 18.5"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="18.5" r="2.2" fill="currentColor" />
      <circle cx="55" cy="18.5" r="4.6" fill="none" strokeWidth="2.6" className="stroke-saffron" />
      <circle cx="55" cy="18.5" r="1.5" className="fill-saffron" />
    </svg>
  );
}

export function Logo({
  compact = false,
  light = false,
  responsive = false,
}: {
  compact?: boolean;
  light?: boolean;
  /** Hide the wordmark below the `sm` breakpoint to leave room for header tools. */
  responsive?: boolean;
}) {
  const { brandName, brandNameAr, logoImage } = useBrand();
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5"
      aria-label={`${brandName} home`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[5px] ${
          logoImage
            ? "bg-[#fffcf6]"
            : light
              ? "bg-white/10 text-on-dark"
              : "bg-brand text-on-dark"
        }`}
      >
        {logoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoImage}
            alt=""
            className="h-full w-full object-contain p-0.5"
          />
        ) : (
          <LogoMark className="h-[22px] w-[22px]" />
        )}
      </span>
      {!compact ? (
        <span
          className={`items-baseline gap-2 ${
            responsive ? "hidden sm:flex" : "flex"
          }`}
        >
          <span
            className={`font-display text-[22px] font-semibold leading-none tracking-[-0.04em] ${
              light ? "text-on-dark" : "text-ink"
            }`}
          >
            {brandName}
          </span>
          <span
            className={`arabic text-[14px] font-medium leading-none ${
              light ? "text-on-dark/55" : "text-muted"
            }`}
          >
            {brandNameAr}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
