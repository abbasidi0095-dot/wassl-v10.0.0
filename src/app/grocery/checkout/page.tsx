import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Grocery checkout is merged into the main /checkout flow. */
export default function GroceryCheckoutRedirect() {
  redirect("/checkout");
}
