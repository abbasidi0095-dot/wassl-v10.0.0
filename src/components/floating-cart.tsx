"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";
import { useI18n } from "./locale-provider";
import { money } from "@/lib/utils";

const HIDDEN_PREFIXES = [
  "/cart",
  "/checkout",
  "/admin",
  "/merchant",
  "/driver",
  "/login",
  "/signup",
  "/verify-email",
  "/verify-phone",
  "/pending",
];

export function FloatingCart() {
  const { t } = useI18n();
  const { count, subtotal, ready } = useCart();
  const pathname = usePathname();

  if (!ready || count === 0) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <Link
      href="/cart"
      className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] start-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand/30 bg-ink px-3.5 py-2 text-on-dark shadow-[var(--shadow-float)] transition-transform hover:-translate-y-0.5 md:bottom-6 md:start-6"
      aria-label={t("Cart: {count} items, {total}", {
        count,
        total: money(subtotal),
      })}
    >
      <span className="relative grid h-7 w-7 place-items-center rounded-full bg-white/10">
        <ShoppingBag size={14} />
        <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-signal px-1 text-[9px] font-semibold text-[#fffaf1] tnum">
          {count}
        </span>
      </span>
      <span className="text-[12px] font-semibold tnum">{money(subtotal)}</span>
      <span className="hidden text-[10px] font-medium text-on-dark/60 sm:inline">
        {t("View cart")}
      </span>
    </Link>
  );
}
