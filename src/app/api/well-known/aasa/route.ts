import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Served at /.well-known/apple-app-site-association (see next.config.ts).
 * APPLE_TEAM_ID is the 10-character Team ID from Apple Developer.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID || "TEAMID";
  const appId = `${teamId}.ma.wassl.app`;

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appId],
            components: [{ "/": "/*" }],
          },
        ],
      },
      webcredentials: { apps: [appId] },
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
