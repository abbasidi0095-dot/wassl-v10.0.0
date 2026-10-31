import type { OrderView } from "./db";

const RESEND_API_URL = "https://api.resend.com/emails";

function getApiKey(): string | undefined {
  return process.env.RESEND_API_KEY || process.env.RESEND_KEY;
}

function getSender(): string {
  // Set RESEND_FROM to an address on a domain verified in Resend. The shared
  // `onboarding@resend.dev` sender only delivers to the Resend account owner.
  return process.env.RESEND_FROM || "Wassl <orders@wassl.ma>";
}

export type EmailResult = { ok: boolean; error?: string };

async function postEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<EmailResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Recipient email is missing" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: getSender(),
        to: [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });

    if (response.ok) return { ok: true };

    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    return {
      ok: false,
      error: payload?.message || `Resend returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email request failed",
    };
  }
}

export async function sendOrderEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  return (await postEmail(to, subject, html)).ok;
}

/**
 * Sends the six-digit sign-in code. The caller decides how to surface a
 * delivery failure; the code itself is never logged.
 */
export async function sendOtpEmail(
  to: string,
  code: string,
): Promise<EmailResult> {
  const subject = `Your Wassl sign-in code: ${code}`;
  const text = [
    "Wassl sign-in code",
    "",
    `Your code is ${code}.`,
    "It expires in 5 minutes.",
    "",
    "If you did not request this code, you can safely ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#fdfcf7;color:#121212;border-radius:16px;border:1px solid #ece7da">
      <div style="font-size:20px;font-weight:800;color:#0f6e6e;letter-spacing:-0.03em">Wassl</div>
      <p style="font-size:13px;color:#666;margin:4px 0 22px">Southern Morocco delivery</p>
      <h1 style="font-size:22px;line-height:1.25;margin:0 0 8px;letter-spacing:-0.03em">Your sign-in code</h1>
      <p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 20px">
        Enter this code in the Wassl app. It expires in <strong>5 minutes</strong>.
      </p>
      <div style="font-size:36px;font-weight:800;letter-spacing:12px;background:#ffffff;border:1px solid #e5e0d5;border-radius:12px;padding:20px 12px 20px 24px;text-align:center;color:#121212;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">
        ${code}
      </div>
      <p style="font-size:12px;line-height:1.6;color:#8a8a8a;margin:20px 0 0">
        If you did not request this code, you can safely ignore this email. Nobody can sign in without it.
      </p>
    </div>
  `;
  return postEmail(to, subject, html, text);
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
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fdfcf7;color:#121212;border-radius:12px">
      <h2 style="color:#0f6e6e;margin-bottom:8px">Wassl Delivery</h2>
      <h3 style="margin-top:0">${title}</h3>
      <p style="font-size:14px;color:#555">
        <strong>Order:</strong> ${order.code}<br/>
        <strong>Store:</strong> ${order.store?.name || "Store"}<br/>
        <strong>Total:</strong> ${order.total} MAD (Cash on Delivery)
      </p>
      <p style="font-size:13px;color:#777;margin-top:20px">
        Track your delivery live on the Wassl app.
      </p>
    </div>
  `;
  const result = await postEmail(recipientEmail, subject, html);
  if (!result.ok && result.error !== "RESEND_API_KEY is not configured") {
    console.error("[email] order notification failed:", result.error);
  }
}
