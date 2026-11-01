import Link from "next/link";
import { getCities, getUserById } from "@/lib/db";
import { getPreferredCity } from "@/lib/city-preference";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { CheckoutSwitch } from "./checkout-switch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery details" };

export default async function CheckoutPage() {
  const [cities, session] = await Promise.all([getCities(), getSession()]);
  const customer =
    session?.role === "customer" ? await getUserById(session.userId) : undefined;
  const currentCity = await getPreferredCity(cities);

  return (
    <>
      <SiteHeader cities={cities} currentCity={currentCity} />
      <main className="container-wassl">
        <PageHeader
          label="Checkout"
          title="Confirm your order"
          description="Delivery or pickup, cash on arrival. Your cart chooses the right flow automatically."
        >
          {!session ? (
            <p className="mt-3 text-[13px] text-muted">
              Checking out as a guest.{" "}
              <Link href="/login?next=customer" className="font-medium text-brand">
                Sign in
              </Link>{" "}
              to keep your order history in one place.
            </p>
          ) : session.role === "customer" ? (
            <p className="mt-3 text-[13px] text-muted">
              Signed in as <strong className="text-muted">{session.email}</strong>. Your
              order will appear in{" "}
              <Link href="/account" className="font-medium text-brand">
                your account
              </Link>
              .
            </p>
          ) : null}
        </PageHeader>
        <CheckoutSwitch
          initialName={customer?.name || (session?.role === "customer" ? session.name : "")}
          initialPhone={customer?.phone || ""}
          initialEmail={customer?.email || (session?.role === "customer" ? session.email : "")}
          lockEmail={session?.role === "customer"}
        />
      </main>
      <SiteFooter />
    </>
  );
}
