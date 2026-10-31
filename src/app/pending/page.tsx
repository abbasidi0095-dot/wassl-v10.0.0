import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import { PendingActions } from "./pending-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account review · Wassl" };

const ROLE_LABEL: Record<string, string> = {
  admin: "Operations",
  customer: "Customer",
  merchant: "Store owner",
  driver: "Driver",
};

export default async function PendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.status === "rejected") redirect("/login?blocked=1");
  if (session.status !== "pending") redirect(homeForRole(session.role));

  return (
    <main className="grid min-h-screen place-items-center bg-cream p-5 sm:p-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-xs font-bold text-ink/55 hover:text-ink">
            Storefront
          </Link>
        </div>

        <div className="card p-7 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron/20 text-saffron-deep">
            <Clock3 size={24} />
          </div>
          <div className="eyebrow mt-5">Account received</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.05em]">
            Almost there, {session.name.split(" ")[0]}.
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            Your account is created. A Wassl operator now reviews new store and
            driver accounts and attaches your workspace before it opens.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-cream/80 p-4 text-sm">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink/40">
                Account
              </dt>
              <dd className="mt-1 font-bold">{session.name}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink/40">
                Requested role
              </dt>
              <dd className="mt-1 font-bold">
                {ROLE_LABEL[session.role] || session.role}
              </dd>
            </div>
          </dl>

          <a
            href="mailto:admin@wassl.ma?subject=Wassl%20account%20approval"
            className="btn btn-primary mt-6 w-full"
          >
            <Mail size={16} /> Contact operations
          </a>
          <div className="mt-3">
            <PendingActions />
          </div>
          <p className="mt-4 text-center text-[11px] leading-5 text-ink/40">
            Already approved? Sign out and sign in again to pick up your new
            access.
          </p>
        </div>
      </div>
    </main>
  );
}
