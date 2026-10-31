"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { money } from "@/lib/utils";
import { useCart } from "./cart-provider";

export function CartMini({ storeId }: { storeId: string }) {
  const { items, count, subtotal, deliveryFee, storeId: cartStore, storeName, minOrder } = useCart();
  if (cartStore !== storeId || !items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 p-4 text-center">
        <ShoppingBag size={20} className="mx-auto text-ink/25" />
        <p className="mt-2 text-[11px] font-bold text-ink/40">
          Add items to start your order.
        </p>
      </div>
    );
  }

  const total = subtotal + deliveryFee;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink/35">
          Your cart
        </span>
        <span className="pill pill-warm">{count} items</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.lineId} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 flex-1 truncate font-bold text-ink/65">
              {item.qty}× {item.name}
              {item.options.length ? (
                <span className="block truncate text-[9px] text-ink/35">
                  {item.options.map((option) => option.optionName).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="font-extrabold">{money(item.price * item.qty)}</span>
          </div>
        ))}
        {items.length > 4 ? (
          <div className="text-[10px] font-bold text-ink/35">+{items.length - 4} more</div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-ink/5 pt-3 text-[11px]">
        <div className="flex justify-between text-ink/45">
          <span>Subtotal</span>
          <span className="font-bold text-ink">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between text-ink/45">
          <span>Delivery</span>
          <span className="font-bold text-ink">{money(deliveryFee)}</span>
        </div>
        <div className="flex justify-between pt-1 text-sm font-extrabold">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>
      {subtotal < minOrder ? (
        <p className="mt-2 rounded-lg bg-saffron/15 px-2 py-1.5 text-[10px] font-bold text-ink/60">
          Add {money(minOrder - subtotal)} more to reach the minimum order.
        </p>
      ) : null}
      <Link
        href="/cart"
        className={`btn mt-3 w-full ${subtotal < minOrder ? "btn-ghost" : "btn-primary"}`}
      >
        Review cart <ArrowRight size={14} />
      </Link>
      <p className="mt-2 text-center text-[9px] font-bold text-ink/30">
        Cash on delivery · {storeName}
      </p>
    </div>
  );
}
