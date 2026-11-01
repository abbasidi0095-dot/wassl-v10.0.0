import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { homeForRole } from "@/lib/auth-config";
import {
  isPhoneVerified,
  maskPhone,
  normalizeMoroccanPhone,
  verifyPhoneTicket,
} from "@/lib/phone";
import { VerifyPhoneForm } from "./verify-phone-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify your mobile · Wassl" };

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    next?: string;
    sent?: string;
    warning?: string;
    cooldown?: string;
    ticket?: string;
  }>;
}) {
  const { email, next, sent, warning, cooldown, ticket } = await searchParams;
  const normalized = email?.trim().toLowerCase() || "";
  if (!normalized) redirect("/login");

  const user = await getUserByEmail(normalized);
  if (!user) redirect("/login");

  if (!isEmailVerified(user)) {
    redirect(
      `/verify-email?email=${encodeURIComponent(user.email)}${
        next === "login" ? "&next=login" : ""
      }`,
    );
  }

  if (isPhoneVerified(user)) {
    const session = await getSession();
    redirect(session ? homeForRole(session.role) : "/login");
  }

  const phone = normalizeMoroccanPhone(user.phone);
  if (!phone) redirect("/login");
  if (!verifyPhoneTicket(user.email, ticket)) redirect("/login");

  return (
    <VerifyPhoneForm
      email={user.email}
      ticket={ticket!}
      maskedPhone={maskPhone(phone)}
      context={next === "login" ? "login" : "signup"}
      sent={sent === "1"}
      startWarning={warning === "1"}
      initialCooldown={Math.max(0, Math.min(600, Number(cooldown) || 0))}
    />
  );
}
