import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type WasslEvent = {
  type: "order" | "driver" | "location" | "store" | "settings";
  orderId?: string;
  storeId?: string;
  citySlug?: string;
  driverId?: string;
  at: string;
  status?: string;
};

export type EventFilter = {
  type?: string;
  excludeType?: string;
  orderId?: string;
  storeId?: string;
  citySlug?: string;
  driverId?: string;
};

type LoggedEvent = { seq: number; event: WasslEvent };

const EVENT_LOG_LIMIT = 1000;

type EventGlobals = {
  __wasslEvents?: EventEmitter;
  __wasslEventLog?: LoggedEvent[];
  __wasslEventSeq?: number;
  __wasslEventEpoch?: string;
};

const globalForEvents = globalThis as unknown as EventGlobals;

const bus =
  globalForEvents.__wasslEvents ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(100);
    globalForEvents.__wasslEvents = emitter;
    return emitter;
  })();

const epoch =
  globalForEvents.__wasslEventEpoch ??
  (() => {
    const value = randomUUID();
    globalForEvents.__wasslEventEpoch = value;
    return value;
  })();

function eventLog(): LoggedEvent[] {
  const log = globalForEvents.__wasslEventLog ?? [];
  globalForEvents.__wasslEventLog = log;
  return log;
}

type EventBatch = { events: WasslEvent[]; active: boolean };

// AsyncLocalStorage keeps concurrent mutations from sharing a buffer. Two
// orders created in parallel must not flush each other's events before the
// other transaction commits (or after it rolls back).
const batches = new AsyncLocalStorage<EventBatch>();

/**
 * Mutations can publish several events before the backing store commits. Hold
 * them in a transaction-scoped buffer so subscribers never observe an event
 * for a write that later rolled back.
 */
export function runWithEventBatch<T>(fn: () => Promise<T>): Promise<T> {
  return batches.run({ events: [], active: true }, fn);
}

function record(event: WasslEvent) {
  const seq = (globalForEvents.__wasslEventSeq ?? 0) + 1;
  globalForEvents.__wasslEventSeq = seq;
  const log = eventLog();
  log.push({ seq, event });
  if (log.length > EVENT_LOG_LIMIT) {
    log.splice(0, log.length - EVENT_LOG_LIMIT);
  }
  bus.emit("event", event);
}

export function flushEventBatch() {
  const batch = batches.getStore();
  if (!batch?.active) return;
  batch.active = false;
  const events = batch.events.splice(0);
  for (const event of events) record(event);
}

export function discardEventBatch() {
  const batch = batches.getStore();
  if (!batch) return;
  batch.active = false;
  batch.events.length = 0;
}

export function publish(event: Omit<WasslEvent, "at">) {
  const full = { ...event, at: new Date().toISOString() } satisfies WasslEvent;
  const batch = batches.getStore();
  if (batch?.active) {
    batch.events.push(full);
    return;
  }
  record(full);
}

export function subscribe(listener: (event: WasslEvent) => void) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}

/** Identifies this server process. Clients use it to detect a restart. */
export function getEventEpoch(): string {
  return epoch;
}

/** The sequence number of the latest recorded event. */
export function getEventCursor(): number {
  return globalForEvents.__wasslEventSeq ?? 0;
}

export function matchesFilter(event: WasslEvent, filter: EventFilter = {}): boolean {
  if (filter.type && event.type !== filter.type) return false;
  if (filter.excludeType && event.type === filter.excludeType) return false;
  if (filter.orderId && event.orderId !== filter.orderId) return false;
  if (filter.storeId && event.storeId !== filter.storeId) return false;
  if (filter.citySlug && event.citySlug !== filter.citySlug) return false;
  if (filter.driverId && event.driverId !== filter.driverId) return false;
  return true;
}

/**
 * Read committed events after a cursor. If the cursor belongs to a previous
 * process (or is otherwise ahead of this log), replay from the start of this
 * process's log instead of silently waiting forever.
 */
export function readEvents(
  cursor: number,
  filter: EventFilter = {},
): { events: WasslEvent[]; cursor: number } {
  const latest = getEventCursor();
  const after = Number.isFinite(cursor) && cursor >= 0 && cursor <= latest ? cursor : 0;
  const events = eventLog()
    .filter((entry) => entry.seq > after && matchesFilter(entry.event, filter))
    .map((entry) => entry.event);
  return { events, cursor: latest };
}

/**
 * Long-poll primitive used by /api/events/poll. It resolves as soon as a
 * matching event is committed, or after `timeoutMs` with an empty batch.
 *
 * This is deliberately a complete JSON response rather than a streaming body:
 * Cloudflare Quick Tunnels buffer `text/event-stream` responses, but ordinary
 * request/response bodies pass through immediately. Named tunnels, local
 * deployments and the SSE endpoint remain available for streaming clients.
 */
export function waitForEvents(
  cursor: number,
  filter: EventFilter,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<{ events: WasslEvent[]; cursor: number }> {
  const initial = readEvents(cursor, filter);
  if (initial.events.length) return Promise.resolve(initial);

  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    const finish = (result: { events: WasslEvent[]; cursor: number }) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const check = () => {
      const result = readEvents(cursor, filter);
      if (result.events.length) finish(result);
    };

    const onAbort = () => {
      finish({ events: [], cursor: getEventCursor() });
    };

    unsubscribe = subscribe(check);
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(
      () => finish(readEvents(cursor, filter)),
      Math.max(1000, Math.min(timeoutMs, 25_000)),
    );

    // Close the race between the synchronous read above and the subscription.
    check();
  });
}
