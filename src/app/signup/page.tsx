import { redirect } from "next/navigation";
import { SignupShell } from "./signup-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account · Wassl" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  if (role === "merchant") redirect("/signup/store");
  if (role === "driver") redirect("/signup/driver");
  return <SignupShell mode="customer" />;
}
