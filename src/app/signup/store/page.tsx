import { SignupShell } from "../signup-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store partner sign up · Wassl" };

export default function StoreSignupPage() {
  return <SignupShell mode="merchant" />;
}
