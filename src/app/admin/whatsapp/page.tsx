import Link from "next/link";
import { RefreshCw, Smartphone } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { StaffHeader } from "@/components/staff-header";
import {
  isWhatsAppConfigured,
  startWhatsAppSession,
  whatsappQr,
  whatsappSessionStatus,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp session · Wassl" };

export default async function AdminWhatsAppPage() {
  const session = await requireRole("admin");
  const configured = isWhatsAppConfigured();
  let status = configured ? await whatsappSessionStatus() : null;

  // Opening this page is the operator's explicit intent to link or re-link the
  // dedicated number, so start a stopped session and fetch a fresh QR.
  if (
    status?.ok &&
    ["created", "disconnected", "failed", "action_required"].includes(
      status.state,
    )
  ) {
    await startWhatsAppSession();
    status = await whatsappSessionStatus();
  }

  let qr = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!status?.ok || status.state === "ready") break;
    const candidate = await whatsappQr();
    if (candidate.ok) {
      qr = candidate;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await whatsappSessionStatus();
  }

  return (
    <div className="staff-shell">
      <StaffHeader
        session={session}
        title="WhatsApp session"
        subtitle="Link the dedicated number used for OTP. OTP stays disabled until the flags are turned on."
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/admin/accounts", label: "Accounts" },
          { href: "/admin/whatsapp", label: "WhatsApp" },
          { href: "/admin/messages", label: "Messages" },
        ]}
        accent="ink"
      />
      <main className="container-wassl py-6">
        <section className="card mx-auto max-w-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">OpenWA</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                Dedicated WhatsApp number
              </h1>
              <p className="mt-2 max-w-[52ch] text-[12px] leading-5 text-muted">
                Scan this code from the dedicated phone: WhatsApp → Settings →
                Linked devices → Link a device. OTP is not affected until
                <code className="mx-1 rounded bg-surface-2 px-1 py-0.5 text-[10px]">
                  OTP_WHATSAPP_ENABLED=1
                </code>
                is set.
              </p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-brand-soft text-brand">
              <Smartphone size={18} />
            </span>
          </div>

          {!configured ? (
            <div className="mt-5 rounded-[8px] border border-danger/30 bg-danger/5 p-4 text-[12px] leading-5">
              OpenWA is not configured. Set <code>OPENWA_API_KEY</code>,{" "}
              <code>OPENWA_SESSION_ID</code> and <code>OPENWA_BASE_URL</code> in
              the server environment, then restart Wassl.
            </div>
          ) : !status?.ok ? (
            <div className="mt-5 rounded-[8px] border border-danger/30 bg-danger/5 p-4 text-[12px] leading-5">
              Could not reach OpenWA: {status?.error ?? "unknown error"}.
            </div>
          ) : status.state === "ready" ? (
            <div className="mt-5 rounded-[8px] border border-success/30 bg-success/10 p-4">
              <div className="text-[13px] font-semibold text-success">
                WhatsApp is linked
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {status.number
                  ? `Connected as ${status.number}.`
                  : "The session is connected and ready."}{" "}
                You can now enable WhatsApp OTP when you are ready.
              </div>
            </div>
          ) : qr?.ok ? (
            <div className="mt-6 flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.qrCode}
                alt="WhatsApp linking QR code"
                className="h-64 w-64 rounded-[10px] border border-line bg-white p-3"
              />
              <p className="mt-3 text-center text-[11px] leading-5 text-muted">
                The QR refreshes every few seconds. Reload this page if it expires.
              </p>
              <Link href="/admin/whatsapp" className="btn btn-ghost btn-sm mt-3">
                <RefreshCw size={13} /> Refresh QR
              </Link>
            </div>
          ) : (
            <div className="mt-5 rounded-[8px] border border-line bg-surface-2 p-4 text-[12px] leading-5 text-muted">
              Session state: <strong>{status.state}</strong>. Reload this page in a
              few seconds while the session starts.
            </div>
          )}

          <div className="mt-6 border-t border-line pt-4 text-[11px] leading-5 text-muted">
            OpenWA is an unofficial WhatsApp Web gateway. Use a dedicated number
            and keep SMS as the fallback.
          </div>
        </section>
      </main>
    </div>
  );
}
