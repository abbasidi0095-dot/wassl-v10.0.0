"use client";

import { useEffect, useRef } from "react";

export type LiveEvent = {
  type: string;
  status?: string;
  orderId?: string;
  storeId?: string;
  citySlug?: string;
  driverId?: string;
  at?: string;
};

type Filter = Record<string, string | undefined>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Realtime updates over a complete-response long poll.
 *
 * Cloudflare Quick Tunnels buffer open `text/event-stream` responses, which is
 * why the first public demo never received staff events. A long poll ends as
 * soon as there is something to deliver, so every normal HTTP proxy forwards
 * it immediately. The hook also wakes up on tab focus/online so a phone that
 * slept does not stay stale.
 */
export function useLiveEvents(
  filter: Filter,
  onEvent: (event: LiveEvent) => void,
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;
  const key = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    let cursor = -1;
    let epoch: string | null = null;
    let controller: AbortController | null = null;

    const base = new URLSearchParams();
    for (const [name, value] of Object.entries(
      JSON.parse(key) as Filter,
    )) {
      if (value) base.set(name, value);
    }

    async function connect() {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const query = new URLSearchParams(base);
          query.set("cursor", String(cursor));
          query.set("timeout", "20000");
          const response = await fetch(`/api/events/poll?${query.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            throw new Error(`Live updates unavailable (${response.status})`);
          }
          const data = (await response.json()) as {
            epoch?: string;
            cursor?: number;
            events?: LiveEvent[];
          };
          if (cancelled) return;

          const restarted = Boolean(epoch && data.epoch && data.epoch !== epoch);
          if (!epoch || restarted) {
            if (restarted) cursor = 0;
            callbackRef.current({ type: "connected" });
          }
          if (data.epoch) epoch = data.epoch;
          if (typeof data.cursor === "number") cursor = data.cursor;

          const events = Array.isArray(data.events) ? data.events : [];
          for (const event of events) {
            if (cancelled) return;
            callbackRef.current(event);
          }

          if (!events.length) await sleep(100);
        } catch {
          if (cancelled) return;
          await sleep(1500);
        }
      }
    }

    void connect();

    const wake = () => {
      if (document.visibilityState === "visible") {
        callbackRef.current({ type: "connected" });
      }
    };
    const onOnline = () => callbackRef.current({ type: "connected" });

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      controller?.abort();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", onOnline);
    };
  }, [key]);
}
