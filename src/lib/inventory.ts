import type { Order, Product, StockReservation, Store } from "./types";

export type InventoryStatus = "fast" | "steady" | "slow" | "out";

export type InventoryProduct = {
  product: Product;
  store: Store;
  stock: number;
  threshold: number;
  soldQty: number;
  revenue: number;
  velocity: number;
  daysLeft: number | null;
  suggestedRestock: number;
  status: InventoryStatus;
};

export type InventoryHistoryEntry = {
  id: string;
  productName: string;
  storeName: string;
  qty: number;
  status: StockReservation["status"];
  at: string;
};

export type InventoryReport = {
  days: number;
  skuCount: number;
  inventoryValue: number;
  lowCount: number;
  outCount: number;
  soldQty: number;
  revenue: number;
  slowCount: number;
  topSellers: InventoryProduct[];
  slowMovers: InventoryProduct[];
  restock: InventoryProduct[];
  history: InventoryHistoryEntry[];
};

function productStock(product: Product): number {
  if (product.variants?.length) {
    return product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  }
  return product.stock ?? 0;
}

function productThreshold(product: Product): number {
  return product.lowStockThreshold ?? 5;
}

/** Inventory, sales velocity and replenishment from real orders and stock. */
export function inventoryIntelligence(input: {
  stores: Store[];
  products: Product[];
  orders: Order[];
  reservations?: StockReservation[];
  now?: Date;
  days?: number;
}): InventoryReport {
  const now = input.now ?? new Date();
  const days = Math.max(1, Math.min(input.days ?? 14, 90));
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const grocery = new Map(
    input.stores
      .filter((store) => store.category === "grocery")
      .map((store) => [store.id, store]),
  );
  const products = input.products.filter((product) => grocery.has(product.storeId));
  const sales = new Map<string, { qty: number; revenue: number }>();

  for (const order of input.orders) {
    if (order.status === "cancelled") continue;
    const created = new Date(order.createdAt).getTime();
    if (!Number.isFinite(created) || created < since) continue;
    if (!grocery.has(order.storeId)) continue;
    for (const line of order.items) {
      const current = sales.get(line.productId) ?? { qty: 0, revenue: 0 };
      current.qty += line.qty;
      current.revenue += line.price * line.qty;
      sales.set(line.productId, current);
    }
  }

  const items: InventoryProduct[] = products.map((product) => {
    const store = grocery.get(product.storeId)!;
    const stock = productStock(product);
    const threshold = productThreshold(product);
    const sold = sales.get(product.id) ?? { qty: 0, revenue: 0 };
    const velocity = sold.qty / days;
    const daysLeft = velocity > 0 ? stock / velocity : null;
    const target = Math.ceil(velocity * days + threshold);
    const suggestedRestock =
      stock <= threshold || (daysLeft !== null && daysLeft < 7)
        ? Math.max(0, target - stock)
        : 0;
    const status: InventoryStatus =
      stock <= 0
        ? "out"
        : sold.qty === 0
          ? "slow"
          : velocity >= 1
            ? "fast"
            : "steady";
    return {
      product,
      store,
      stock,
      threshold,
      soldQty: sold.qty,
      revenue: sold.revenue,
      velocity,
      daysLeft,
      suggestedRestock,
      status,
    };
  });

  const topSellers = [...items]
    .filter((item) => item.soldQty > 0)
    .sort((a, b) => b.soldQty - a.soldQty || b.revenue - a.revenue)
    .slice(0, 6);
  const slowMovers = [...items]
    .filter((item) => item.soldQty === 0 && item.stock > 0)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 6);
  const restock = [...items]
    .filter((item) => item.suggestedRestock > 0)
    .sort((a, b) => a.daysLeft === null ? 1 : b.daysLeft === null ? -1 : a.daysLeft - b.daysLeft)
    .slice(0, 8);

  const byId = new Map(products.map((product) => [product.id, product]));
  const history = [...(input.reservations ?? [])]
    .filter((entry) => byId.has(entry.productId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20)
    .map((entry) => {
      const product = byId.get(entry.productId)!;
      return {
        id: entry.id,
        productName: product.name,
        storeName: grocery.get(product.storeId)?.name ?? "",
        qty: entry.qty,
        status: entry.status,
        at: entry.createdAt,
      };
    });

  return {
    days,
    skuCount: items.length,
    inventoryValue: items.reduce((sum, item) => sum + item.stock * item.product.price, 0),
    lowCount: items.filter((item) => item.stock > 0 && item.stock <= item.threshold).length,
    outCount: items.filter((item) => item.stock <= 0).length,
    soldQty: items.reduce((sum, item) => sum + item.soldQty, 0),
    revenue: items.reduce((sum, item) => sum + item.revenue, 0),
    slowCount: items.filter((item) => item.soldQty === 0 && item.stock > 0).length,
    topSellers,
    slowMovers,
    restock,
    history,
  };
}
