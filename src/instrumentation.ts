/**
 * Fail fast when the production server starts without a signing secret. The
 * build phase is exempt because it does not issue any sessions.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NODE_ENV === "production" && !process.env.WASSL_SECRET) {
    throw new Error(
      "WASSL_SECRET is required in production. Set a long random value in the service environment.",
    );
  }
}
