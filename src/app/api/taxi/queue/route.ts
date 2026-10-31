import { NextResponse } from "next/server";
import { requireApiRole, isResponse } from "@/lib/api-auth";
import { getDriver, getTaxiRides } from "@/lib/db";
import { TAXI_ACTIVE_STATUSES } from "@/lib/taxi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Driver queue: open requests in the driver's city plus their assigned rides. */
export async function GET(request: Request) {
  const session = requireApiRole(request, ["driver", "admin"]);
  if (isResponse(session)) return session;

  const url = new URL(request.url);
  const citySlug =
    session.role === "driver" && session.driverId
      ? (await getDriver(session.driverId))?.citySlug
      : url.searchParams.get("citySlug") || undefined;

  const open = await getTaxiRides({
    citySlug,
    status: "requested",
    limit: 50,
  });
  const assigned =
    session.role === "driver" && session.driverId
      ? await getTaxiRides({ driverId: session.driverId, limit: 20 })
      : [];

  const safe = (ride: (typeof open)[number]) => {
    const { verificationCode, ...rest } = ride;
    return { ...rest, handoverRequired: Boolean(verificationCode) };
  };

  return NextResponse.json({
    open: session.role === "driver" ? open.map(safe) : open,
    assigned: assigned
      .filter((ride) => TAXI_ACTIVE_STATUSES.includes(ride.status))
      .map(safe),
  });
}
