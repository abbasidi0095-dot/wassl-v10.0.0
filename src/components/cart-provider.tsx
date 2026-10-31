"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SelectedModifier } from "@/lib/types";

export type CartItem = {
  /** product id plus the sorted modifier ids, so variants stay separate lines. */
  lineId: string;
  productId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  citySlug: string;
  storeLat: number;
  storeLng: number;
  deliveryFee: number;
  minOrder: number;
  name: string;
  emoji: string;
  image?: string;
  basePrice: number;
  storeCategory?: "restaurant" | "grocery" | "pharmacy" | "cafe" | "gifts";
  variantId?: string;
  variantLabel?: string;
  sku?: string;
  unit?: string;
  stockMax?: number;
  /** Base price plus every selected modifier. */
  price: number;
  options: SelectedModifier[];
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  storeId: string | null;
  storeName: string | null;
  storeSlug: string | null;
  storeCategory: CartItem["storeCategory"] | null;
  deliveryFee: number;
  minOrder: number;
  storeLat: number | null;
  storeLng: number | null;
  addItem: (item: Omit<CartItem, "qty" | "lineId">, qty?: number) => void;
  setQty: (lineId: string, qty: number) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
  lastAdded: string | null;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "wassl_cart_v2";

export function cartLineId(productId: string, options: SelectedModifier[]) {
  const suffix = options
    .map((option) => option.optionId)
    .sort()
    .join("+");
  const variant = options.find((option) => option.groupId === "__variant")?.optionId;
  const parts = [variant, suffix].filter(Boolean);
  return parts.length ? `${productId}::${parts.join("::")}` : productId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(
            parsed
              .filter((line) => line && typeof line.productId === "string")
              .map((line) => ({
                ...line,
                lineId: line.lineId || cartLineId(line.productId, line.options ?? []),
                options: line.options ?? [],
                basePrice: line.basePrice ?? line.price,
              })),
          );
        }
      }
    } catch {
      // ignore an invalid local cart
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("wassl-cart", { detail: items.length }));
  }, [items, ready]);

  useEffect(() => {
    if (!lastAdded) return;
    const timeout = window.setTimeout(() => setLastAdded(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastAdded]);

  const addItem = useCallback((item: Omit<CartItem, "qty" | "lineId">, qty = 1) => {
    const lineId = cartLineId(item.productId, item.options);
    setItems((current) => {
      const sameStore = current[0]?.storeId === item.storeId;
      const base = sameStore ? current : [];
      const existing = base.find((line) => line.lineId === lineId);
      if (existing) {
        return base.map((line) =>
          line.lineId === lineId
            ? { ...line, qty: Math.min(20, line.stockMax ?? 20, line.qty + qty) }
            : line,
        );
      }
      return [
        ...base,
        {
          ...item,
          lineId,
          qty: Math.min(20, item.stockMax ?? 20, Math.max(1, qty)),
        },
      ];
    });
    setLastAdded(item.name);
  }, []);

  const setQty = useCallback((lineId: string, qty: number) => {
    setItems((current) =>
      qty <= 0
        ? current.filter((line) => line.lineId !== lineId)
        : current.map((line) =>
            line.lineId === lineId
              ? { ...line, qty: Math.min(20, line.stockMax ?? 20, qty) }
              : line,
          ),
    );
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((current) => current.filter((line) => line.lineId !== lineId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    return {
      items,
      ready,
      count,
      subtotal,
      storeId: items[0]?.storeId ?? null,
      storeName: items[0]?.storeName ?? null,
      storeSlug: items[0]?.storeSlug ?? null,
      storeCategory: items[0]?.storeCategory ?? null,
      deliveryFee: items[0]?.deliveryFee ?? 0,
      minOrder: items[0]?.minOrder ?? 0,
      storeLat: items[0]?.storeLat ?? null,
      storeLng: items[0]?.storeLng ?? null,
      addItem,
      setQty,
      removeItem,
      clear,
      lastAdded,
    };
  }, [items, ready, addItem, setQty, removeItem, clear, lastAdded]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {lastAdded ? (
        <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-bold text-on-dark shadow-2xl md:bottom-8">
          Added {lastAdded} to cart
        </div>
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
