/**
 * OpenWA WhatsApp delivery, server-only.
 *
 * OpenWA is an unofficial WhatsApp Web gateway. It must be linked to a
 * dedicated number, kept on loopback, and monitored for disconnects.
 */
const DEFAULT_BASE = "http://127.0.0.1:2785/api";

export type WhatsAppResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: "not_on_whatsapp" | "not_ready" | "provider" };

function config() {
  return {
    base: (process.env.OPENWA_BASE_URL || DEFAULT_BASE).replace(/\/+$/, ""),
    key: process.env.OPENWA_API_KEY || "",
    session: process.env.OPENWA_SESSION_ID || "",
  };
}

export function isWhatsAppConfigured(): boolean {
  const { key, session } = config();
  return Boolean(key && session);
}

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function request(path: string, init?: RequestInit) {
  const { base, key, session } = config();
  if (!key || !session) {
    return { ok: false as const, error: "WhatsApp OTP is not configured." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${base}/sessions/${encodeURIComponent(session)}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok) {
      const message =
        (typeof data?.message === "string" && data.message) ||
        (typeof data?.error === "string" && data.error) ||
        `OpenWA returned ${response.status}.`;
      return {
        ok: false as const,
        error: message,
        status: response.status,
      };
    }
    return { ok: true as const, data };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error && error.name === "AbortError"
          ? "OpenWA timed out."
          : "Could not reach OpenWA.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Confirm the recipient is a registered WhatsApp account before sending. */
export async function whatsappRegistered(phone: string): Promise<
  { ok: true; exists: boolean; id: string | null } | { ok: false; error: string }
> {
  const number = digits(phone);
  const result = await request(`/contacts/check/${number}`);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    exists: Boolean(result.data?.exists),
    id: typeof result.data?.whatsappId === "string" ? result.data.whatsappId : null,
  };
}

export async function sendWhatsAppOtp(phone: string, code: string): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, error: "WhatsApp OTP is not configured.", code: "provider" };
  }
  const number = digits(phone);
  const check = await whatsappRegistered(phone);
  if (!check.ok) {
    const notReady = /not (started|connected|ready)|session/i.test(check.error);
    return {
      ok: false,
      error: check.error,
      code: notReady ? "not_ready" : "provider",
    };
  }
  if (!check.exists) {
    return {
      ok: false,
      error: "This number is not registered on WhatsApp.",
      code: "not_on_whatsapp",
    };
  }

  const text = `Wassl: ${code} is your verification code. It expires in 10 minutes. Never share it.`;
  const result = await request("/messages/send-text", {
    method: "POST",
    headers: {
      "Idempotency-Key": `otp:${number}:${code}`,
    },
    body: JSON.stringify({
      chatId: check.id || `${number}@c.us`,
      text,
      linkPreview: false,
    }),
  });
  if (!result.ok) {
    const notReady = /not (started|connected|ready)|session|409/i.test(result.error);
    return {
      ok: false,
      error: result.error,
      code: notReady ? "not_ready" : "provider",
    };
  }
  const id =
    typeof result.data?.id === "string"
      ? result.data.id
      : typeof result.data?.messageId === "string"
        ? result.data.messageId
        : undefined;
  return { ok: true, id };
}

/** Used by the admin readiness card; does not send a message. */
export async function whatsappSessionStatus(): Promise<
  { ok: true; state: string; number?: string } | { ok: false; error: string }
> {
  const result = await request("");
  if (!result.ok) return { ok: false, error: result.error };
  const state =
    (typeof result.data?.state === "string" && result.data.state) ||
    (typeof result.data?.status === "string" && result.data.status) ||
    "unknown";
  const number =
    typeof result.data?.phone === "string"
      ? result.data.phone
      : typeof result.data?.number === "string"
        ? result.data.number
        : undefined;
  return { ok: true, state, number };
}

export async function whatsappQr(): Promise<
  | { ok: true; status: string; qrCode: string }
  | { ok: false; error: string }
> {
  const result = await request("/qr");
  if (!result.ok) return { ok: false, error: result.error };
  const qrCode = typeof result.data?.qrCode === "string" ? result.data.qrCode : "";
  const status = typeof result.data?.status === "string" ? result.data.status : "unknown";
  if (!qrCode) return { ok: false, error: "OpenWA did not return a QR code." };
  return { ok: true, status, qrCode };
}

export async function startWhatsAppSession(): Promise<
  { ok: true; state: string } | { ok: false; error: string }
> {
  const result = await request("/start", { method: "POST" });
  if (!result.ok) return { ok: false, error: result.error };
  const state =
    (typeof result.data?.status === "string" && result.data.status) ||
    (typeof result.data?.state === "string" && result.data.state) ||
    "unknown";
  return { ok: true, state };
}
