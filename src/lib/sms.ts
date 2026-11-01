/**
 * Aion Messaging SMS delivery, server-only.
 *
 * The API key never reaches the browser. Sender IDs must be approved in the
 * Aion dashboard before Morocco routes will accept a message.
 */
const DEFAULT_BASE = "https://aionmessaging.com/api/v1";

export type SmsResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return Boolean(process.env.AION_API_KEY && process.env.AION_SENDER_ID);
}

export function maskSmsError(error: string): string {
  return error.replace(/sk_[a-z0-9]+/gi, "sk_***");
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const key = process.env.AION_API_KEY;
  const sender = process.env.AION_SENDER_ID;
  if (!key || !sender) {
    return { ok: false, error: "SMS is not configured on this server." };
  }

  const base = (process.env.AION_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${base}/sms/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": key,
      },
      body: JSON.stringify({
        to,
        sender_id: sender,
        message,
        priority: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | { success?: boolean; message_id?: string; error?: string }
      | null;

    if (!response.ok || data?.success === false) {
      const error =
        data?.error ||
        (response.status === 422
          ? "The SMS provider rejected the message."
          : `SMS provider returned ${response.status}.`);
      return { ok: false, error: maskSmsError(error) };
    }
    return { ok: true, id: data?.message_id };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "SMS provider timed out."
        : "Could not reach the SMS provider.";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export function otpSmsBody(code: string): string {
  return `Wassl: ${code} is your verification code. It expires in 10 minutes. Never share it.`;
}
