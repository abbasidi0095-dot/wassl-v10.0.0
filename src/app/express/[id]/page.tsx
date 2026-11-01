import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCities, getParcel } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StaffHeader } from "@/components/staff-header";
import { ParcelTracking } from "./parcel-tracking";

export const dynamic = "force-dynamic";

export default async function ParcelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=express");
  const { id } = await params;
  const parcel = await getParcel(id);
  if (!parcel) notFound();
  const allowed =
    session.role === "admin" ||
    parcel.customerId === session.userId ||
    (session.role === "driver" && parcel.driverId === session.driverId);
  if (!allowed) notFound();

  if (session.role === "admin") {
    return (
      <div className="staff-shell">
        <StaffHeader
          session={session}
          title={`Parcel ${parcel.code}`}
          subtitle={`${parcel.citySlug} · ${parcel.status}`}
          links={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/express", label: "Express" },
            { href: "/admin/messages", label: "Messages" },
          ]}
          accent="ink"
        />
        <main className="container-wassl py-6">
          <ParcelTracking initial={parcel} role="admin" />
        </main>
      </div>
    );
  }

  const cities = await getCities();
  const city =
    cities.find((entry) => entry.slug === parcel.citySlug) ??
    cities.find((entry) => entry.slug === "dakhla") ??
    cities[0];

  return (
    <>
      <SiteHeader cities={cities} currentCity={city} />
      <main className="container-wassl py-6 lg:py-10">
        <ParcelTracking initial={parcel} role="customer" />
      </main>
      <SiteFooter />
    </>
  );
}
