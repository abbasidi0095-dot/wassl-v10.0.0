import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getCities, getTaxiRide } from "@/lib/db";
import { getTranslator } from "@/lib/i18n-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TaxiTracking } from "./taxi-tracking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your ride" };

export default async function TaxiRidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=taxi/${id}`);

  const ride = await getTaxiRide(id);
  if (!ride) notFound();

  const allowed =
    session.role === "admin" ||
    ride.customerId === session.userId ||
    (session.role === "driver" && ride.driverId === session.driverId);
  if (!allowed) notFound();

  const { t } = await getTranslator();
  const cities = await getCities();

  return (
    <>
      <SiteHeader cities={cities} />
      <main className="container-wassl py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/taxi"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft size={14} className="rtl:-scale-x-100" />
            {t("Back")} · {t("Taxi")}
          </Link>
          <span className="pill">{ride.id.toUpperCase()}</span>
        </div>
        <div className="mt-4">
          <TaxiTracking ride={ride} role={session.role} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
