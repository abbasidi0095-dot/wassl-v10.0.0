import type { OrderView } from "./db";
import { isTestMode } from "./email-verification";

/**
 * Transactional email through Brevo.
 *
 * `BREVO_API_KEY` is required in production. The sender must be an address
 * verified inside the Brevo account; `BREVO_SENDER_EMAIL` makes that explicit.
 * Netlify/Fly secrets hold both values — never commit them.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function getApiKey(): string | undefined {
  return process.env.BREVO_API_KEY;
}

function getSender(): { email: string; name: string } {
  return {
    email: process.env.BREVO_SENDER_EMAIL || "abbasidi0095@gmail.com",
    name: process.env.BREVO_SENDER_NAME || "Wassl",
  };
}

export type EmailResult = { ok: boolean; error?: string; id?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function postEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<EmailResult> {
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Recipient email is missing" };
  }

  if (isTestMode()) {
    // Local/e2e runs must never email a real address from a test fixture.
    return { ok: true, id: "test-mode" };
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not configured" };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: getSender(),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(text ? { textContent: text } : {}),
        ...(process.env.BREVO_REPLY_TO
          ? { replyTo: { email: process.env.BREVO_REPLY_TO } }
          : {}),
        tags: ["wassl-transactional"],
        headers: { "X-Mailin-custom": "wassl" },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { messageId?: string; message?: string; code?: string }
      | null;

    if (response.ok) {
      return { ok: true, id: payload?.messageId };
    }
    return {
      ok: false,
      error:
        payload?.message ||
        `Brevo returned HTTP ${response.status}${payload?.code ? ` (${payload.code})` : ""}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email request failed",
    };
  }
}

function otpEmailHtml(code: string, name?: string): string {
  const greeting = name?.trim() ? `Hello ${escapeHtml(name.trim())},` : "Hello,";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Your Wassl verification code</title>
  </head>
  <body style="margin:0;padding:0;background:#f0ede6;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your Wassl code is ${code}. It expires in 10 minutes.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#faf9f6;border:1px solid #dcd3c4;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.04em;color:#0c1a17;">
                  Wassl<span style="color:#955b0b;">.</span>
                </div>
                <div style="margin-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#5c6a64;">
                  Southern Morocco delivery
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.2;letter-spacing:-0.03em;color:#0c1a17;">
                  Verify your email
                </h1>
                <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#5c6a64;">
                  ${greeting} use the code below to finish setting up your Wassl account.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <div style="background:#ffffff;border:1px solid #dcd3c4;border-radius:8px;padding:20px 12px;text-align:center;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:38px;line-height:1;letter-spacing:0.28em;font-weight:700;color:#0c1a17;">
                  ${code}
                </div>
                <p style="margin:12px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#5c6a64;text-align:center;">
                  This code expires in <strong style="color:#0c1a17;">10 minutes</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 28px 32px;">
                <div style="height:2px;width:36px;background:#955b0b;"></div>
                <p style="margin:14px 0 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#5c6a64;">
                  If you did not create a Wassl account, ignore this email. Nobody can sign in
                  without this code, and it can only be used once.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f0ede6;border-top:1px solid #dcd3c4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#5c6a64;">
                Wassl · الداخلة · العيون · بوجدور · السمارة · طرفاية<br />
                Cash on delivery across Southern Morocco.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function otpEmailText(code: string, name?: string): string {
  const greeting = name?.trim() ? `Hello ${name.trim()},` : "Hello,";
  return [
    "Wassl — Southern Morocco delivery",
    "",
    "Verify your email",
    "",
    `${greeting} use this code to finish setting up your Wassl account:`,
    "",
    code,
    "",
    "This code expires in 10 minutes.",
    "",
    "If you did not create a Wassl account, ignore this email. Nobody can sign in without this code, and it can only be used once.",
  ].join("\n");
}

export function renderVerificationEmail(code: string, name?: string) {
  return {
    subject: "Your Wassl verification code",
    html: otpEmailHtml(code, name),
    text: otpEmailText(code, name),
  };
}

/**
 * Sends the six-digit verification code. The caller decides how to surface a
 * delivery failure; the code itself is never logged.
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  name?: string,
): Promise<EmailResult> {
  const message = renderVerificationEmail(code, name);
  return postEmail(to, message.subject, message.html, message.text);
}

export async function sendOrderEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  return (await postEmail(to, subject, html)).ok;
}

export async function notifyOrderStatusChange(
  order: OrderView,
  recipientEmail?: string,
): Promise<void> {
  if (!recipientEmail) return;
  const statusLabels: Record<string, string> = {
    placed: "Order placed successfully",
    accepted: "Store confirmed your order",
    preparing: "Kitchen is preparing your food",
    ready: "Order is ready for pickup",
    assigned: "Driver assigned to your delivery",
    picked_up: "Driver picked up your order",
    en_route: "Your order is on the way",
    delivered: "Order delivered successfully",
    cancelled: "Order cancelled",
  };

  const title = statusLabels[order.status] || `Order status: ${order.status}`;
  const subject = `[${order.code}] ${title} · Wassl`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#faf9f6;color:#0c1a17;border-radius:12px">
      <h2 style="color:#0b4a45;margin-bottom:8px">Wassl</h2>
      <h3 style="margin-top:0">${escapeHtml(title)}</h3>
      <p style="font-size:14px;color:#5c6a64">
        <strong>Order:</strong> ${escapeHtml(order.code)}<br/>
        <strong>Store:</strong> ${escapeHtml(order.store?.name || "Store")}<br/>
        <strong>Total:</strong> ${order.total} MAD (Cash on Delivery)
      </p>
      <p style="font-size:13px;color:#5c6a64;margin-top:20px">
        Track your delivery live on the Wassl app.
      </p>
    </div>
  `;
  const result = await postEmail(recipientEmail, subject, html);
  if (!result.ok && result.error !== "BREVO_API_KEY is not configured") {
    console.error("[email] order notification failed:", result.error);
  }
}
