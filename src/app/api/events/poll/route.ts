import { authorizeEventRequest } from "@/lib/event-auth";
import {
  getEventCursor,
  getEventEpoch,
  waitForEvents,
} from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tunnel-safe realtime transport.
 *
 * A long poll is a normal HTTP request that ends as soon as an event is
 * committed. Cloudflare (including Quick Tunnels) forwards the completed
 * response immediately even though it buffers an open SSE stream.
 */
export async function GET(request: Request) {
  const authorized = await authorizeEventRequest(request);
  if (authorized instanceof Response) return authorized;

  const url = new URL(request.url);
  const rawCursor = url.searchParams.get("cursor");
  const parsedCursor = rawCursor === null ? -1 : Number(rawCursor);
  let cursor = Number.isFinite(parsedCursor) ? Math.trunc(parsedCursor) : -1;

  // A negative cursor means "start from now"; the client is not interested in
  // replaying the whole in-memory log on first mount.
  if (cursor < 0) cursor = getEventCursor();

  const requestedTimeout = Number(url.searchParams.get("timeout") || 20_000);
  const timeout = Number.isFinite(requestedTimeout) ? requestedTimeout : 20_000;
  const result = await waitForEvents(
    cursor,
    authorized.filter,
    timeout,
    request.signal,
  );

  return Response.json(
    {
      ok: true,
      epoch: getEventEpoch(),
      cursor: result.cursor,
      events: result.events,
      at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, no-transform",
        "X-Accel-Buffering": "no",
      },
    },
  );
}
