import { SignupShell } from "../signup-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Taxi driver sign up · Wassl" };

export default function TaxiSignupPage() {
  return <SignupShell mode="driver" defaultKind="taxi" />;
}
