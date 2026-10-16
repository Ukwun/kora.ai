import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, getOAuthBaseUrl } from "@/lib/social-auth";

export async function GET(request: NextRequest) {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId || !process.env.FACEBOOK_APP_SECRET) {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  let appUrl: string;
  try {
    appUrl = getOAuthBaseUrl(request);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  const state = createOAuthState();
  const authorizationUrl = new URL("https://www.facebook.com/dialog/oauth");
  authorizationUrl.searchParams.set("client_id", appId);
  authorizationUrl.searchParams.set("redirect_uri", `${appUrl}/api/auth/facebook/callback`);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "email,public_profile");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("kora_facebook_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/facebook",
    maxAge: 600,
  });
  return response;
}
