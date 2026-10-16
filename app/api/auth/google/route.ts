import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, getOAuthBaseUrl } from "@/lib/social-auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  let appUrl: string;
  try {
    appUrl = getOAuthBaseUrl(request);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  const state = createOAuthState();
  const callbackUrl = `${appUrl}/api/auth/google/callback`;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("kora_google_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return response;
}
