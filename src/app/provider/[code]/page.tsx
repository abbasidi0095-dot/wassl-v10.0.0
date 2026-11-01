import { notFound } from "next/navigation";
import { getServiceBookings, getServiceProviderByCode } from "@/lib/db";
import { SERVICE_CATEGORIES } from "@/lib/services";
import { StaffHeader } from "@/components/staff-header";
import { ProviderBookings } from "./provider-bookings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Provider workspace" };

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const provider = await getServiceProviderByCode(code);
  if (!provider) notFound();
  const bookings = await getServiceBookings({ providerId: provider.id, limit: 100 });
  const category =
    SERVICE_CATEGORIES.find((entry) => entry.id === provider.category)?.label ??
    provider.category;

  return (
    <div className="staff-shell">
      <StaffHeader
        session={{
          userId: provider.id,
          role: "merchant",
          name: provider.name,
          status: "active",
          storeId: provider.id,
        }}
        title={provider.name}
        subtitle={`${category} · ${provider.citySlug}`}
        links={[{ href: `/provider/${provider.accessCode}`, label: "Bookings" }]}
        accent="saffron"
      />
      <main className="container-wassl py-6">
        <div className="max-w-3xl">
          <h1 className="display text-3xl">{provider.name}</h1>
          <p className="mt-1 text-[12px] text-muted">
            {provider.description}
          </p>
          <ProviderBookings initial={bookings} accessCode={provider.accessCode} />
        </div>
      </main>
    </div>
  );
}
