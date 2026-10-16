import { NextResponse } from "next/server";

export function GET() {
  const providers: string[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) providers.push("Google");
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) providers.push("Facebook");
  if (
    process.env.APPLE_CLIENT_ID
    && process.env.APPLE_TEAM_ID
    && process.env.APPLE_KEY_ID
    && process.env.APPLE_PRIVATE_KEY
  ) {
    providers.push("Apple");
  }

  return NextResponse.json({ providers }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
