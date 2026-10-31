"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { money } from "@/lib/utils";
import { useCart } from "./cart-provider";

export function CartMini({ storeId }: { storeId: string }) {
  const { items, count, subtotal, deliveryFee, storeId: cartStore, storeName, minOrder } = useCart();
  if (cartStore !== storeId || !items.length) {
    return (
      <div className="rounded-[10px] border border-line bg-surface p-4 text-center">
        <ShoppingBag size={18} className="mx-auto text-muted" />
        <p className="mt-2 text-[11px] text-muted">
          Add items to start your order.
        </p>
      </div>
    );
  }

  const total = subtotal + deliveryFee;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">
          Your cart
        </span>
        <span className="text-[11px] text-muted tnum">{count} items</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.lineId} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="min-w-0 flex-1 truncate font-medium">
              {item.qty}× {item.name}
              {item.options.length ? (
                <span className="block truncate text-[10px] text-muted">
                  {item.options.map((option) => option.optionName).join(" · ")}
                </span>
              ) : null}
            </span>
            <span className="font-semibold tnum">{money(item.price * item.qty)}</span>
          </div>
        ))}
        {items.length > 4 ? (
          <div className="text-[10px] text-muted">+{items.length - 4} more</div>
        ) : null}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-[11px]">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span className="font-medium text-ink tnum">{money(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Delivery</span>
          <span className="font-medium text-ink tnum">{money(deliveryFee)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-[13px] font-semibold">
          <span>Total</span>
          <span className="tnum">{money(total)}</span>
        </div>
      </div>
      {subtotal < minOrder ? (
        <p className="mt-2 text-[10px] text-signal">
          Add {money(minOrder - subtotal)} more to reach the minimum order.
        </p>
      ) : null}
      <Link
        href="/cart"
        className={`btn mt-3 w-full ${subtotal < minOrder ? "btn-ghost" : "btn-primary"}`}
      >
        Review cart <ArrowRight size={14} />
      </Link>
      <p className="mt-2 text-center text-[10px] text-muted">
        Cash on delivery · {storeName}
      </p>
    </div>
  );
}
