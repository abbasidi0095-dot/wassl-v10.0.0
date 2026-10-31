import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import { isEmailVerified, maskEmail } from "@/lib/email-verification";
import { homeForRole } from "@/lib/auth-config";
import { VerifyEmailForm } from "./verify-email-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your email · Wassl" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    next?: string;
    warning?: string;
    cooldown?: string;
  }>;
}) {
  const { email, next, warning, cooldown } = await searchParams;
  const normalized = email?.trim().toLowerCase() || "";
  if (!normalized) redirect("/login");

  const user = await getUserByEmail(normalized);
  if (!user) redirect("/login");

  // Seeded and staff-provisioned accounts are verified by definition.
  if (isEmailVerified(user)) {
    const session = await getSession();
    redirect(session ? homeForRole(session.role) : "/login");
  }

  return (
    <VerifyEmailForm
      email={user.email}
      maskedEmail={maskEmail(user.email)}
      context={next === "login" ? "login" : "signup"}
      startWarning={warning === "1"}
      initialCooldown={Math.max(0, Math.min(600, Number(cooldown) || 0))}
    />
  );
}
