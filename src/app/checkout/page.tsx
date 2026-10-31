import Link from "next/link";
import { getCities, getUserById } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CheckoutSwitch } from "./checkout-switch";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery details" };

export default async function CheckoutPage() {
  const [cities, session] = await Promise.all([getCities(), getSession()]);
  const customer =
    session?.role === "customer" ? await getUserById(session.userId) : undefined;

  return (
    <>
      <SiteHeader cities={cities} currentCity={cities.find((city) => city.slug === "dakhla")} />
      <main className="container-wassl pt-8 lg:pt-12">
        <div className="max-w-2xl">
          <div className="eyebrow">Almost there</div>
          <h1 className="display mt-2 text-5xl">Checkout</h1>
          <p className="mt-3 text-sm leading-6 text-ink/50">
            Delivery or pickup, cash on arrival. Your cart chooses the right flow
            automatically.
          </p>
          {!session ? (
            <p className="mt-3 text-xs text-ink/45">
              Checking out as a guest.{" "}
              <Link href="/login?next=customer" className="font-extrabold text-teal hover:text-teal-dark">
                Sign in
              </Link>{" "}
              to keep your order history in one place.
            </p>
          ) : session.role === "customer" ? (
            <p className="mt-3 text-xs text-ink/45">
              Signed in as <strong className="text-ink/70">{session.email}</strong>. Your
              order will appear in{" "}
              <Link href="/account" className="font-extrabold text-teal hover:text-teal-dark">
                your account
              </Link>
              .
            </p>
          ) : null}
        </div>
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
