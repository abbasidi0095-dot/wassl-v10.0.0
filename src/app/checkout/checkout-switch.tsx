"use client";

import { useCart } from "@/components/cart-provider";
import { GroceryCheckout } from "@/app/grocery/checkout/grocery-checkout";
import { CheckoutForm } from "./checkout-form";

export function CheckoutSwitch({
  initialName,
  initialPhone,
  initialEmail,
  lockEmail,
}: {
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  lockEmail: boolean;
}) {
  const { ready, storeCategory } = useCart();
  if (!ready) return <div className="card mt-8 h-56 animate-pulse" />;
  if (storeCategory === "grocery") return <GroceryCheckout />;
  return (
    <CheckoutForm
      initialName={initialName}
      initialPhone={initialPhone}
      initialEmail={initialEmail}
      lockEmail={lockEmail}
    />
  );
}
