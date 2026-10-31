import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Served at /.well-known/assetlinks.json (see next.config.ts rewrites).
 * Set ANDROID_APP_CERT_SHA256 to the Play App Signing SHA-256 fingerprint
 * (comma-separated for upload + Play signing certificates).
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_APP_CERT_SHA256 || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "ma.wassl.app",
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
