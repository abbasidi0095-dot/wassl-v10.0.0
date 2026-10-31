import { authorizeEventRequest } from "@/lib/event-auth";
import { matchesFilter, subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorized = await authorizeEventRequest(request);
  if (authorized instanceof Response) return authorized;
  const { filter } = authorized;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: "connected", at: new Date().toISOString() });

      const unsubscribe = subscribe((event) => {
        if (!matchesFilter(event, filter)) return;
        send(event);
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
