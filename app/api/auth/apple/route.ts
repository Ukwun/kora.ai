import { NextRequest, NextResponse } from "next/server";
import { createOAuthState, getOAuthBaseUrl } from "@/lib/social-auth";

export async function GET(request: NextRequest) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId || !process.env.APPLE_TEAM_ID || !process.env.APPLE_KEY_ID || !process.env.APPLE_PRIVATE_KEY) {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  let appUrl: string;
  try {
    appUrl = getOAuthBaseUrl(request);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  const state = createOAuthState();
  const nonce = createOAuthState();
  const authorizationUrl = new URL("https://appleid.apple.com/auth/authorize");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", `${appUrl}/api/auth/apple/callback`);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("response_mode", "form_post");
  authorizationUrl.searchParams.set("scope", "name email");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);

  const response = NextResponse.redirect(authorizationUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/api/auth/apple",
    maxAge: 600,
  };
  response.cookies.set("kora_apple_oauth_state", state, cookieOptions);
  response.cookies.set("kora_apple_oauth_nonce", nonce, cookieOptions);
  return response;
}
