import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { homeForRole } from "@/lib/auth-config";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in · Wassl" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; blocked?: string }>;
}) {
  const session = await getSession();
  if (session && session.status !== "rejected") {
    // Accounts created by self-service sign-up wait here until operations
    // approve them.
    if (session.status === "pending") redirect("/pending");
    redirect(homeForRole(session.role));
  }
  const { next, blocked } = await searchParams;
  return <LoginForm next={next} blocked={blocked === "1"} />;
}
