import { NextRequest, NextResponse } from "next/server";
import { getOAuthBaseUrl, signInWithVerifiedOAuthEmail } from "@/lib/social-auth";

type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleProfile = { email?: string; name?: string; email_verified?: boolean };

export async function GET(request: NextRequest) {
  let appUrl: string;
  try {
    appUrl = getOAuthBaseUrl(request);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("kora_google_oauth_state")?.value;
  if (request.nextUrl.searchParams.has("error") || !clientId || !clientSecret || !code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/auth?error=google_auth", request.url));
  }

  try {
    const callbackUrl = `${appUrl}/api/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: "authorization_code" }),
    });
    const token = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || token.error || "Google token exchange failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json() as GoogleProfile;
    if (!profileResponse.ok || !profile.email || !profile.email_verified) throw new Error("Google did not return a verified email address");

    const response = await signInWithVerifiedOAuthEmail(request, { email: profile.email, name: profile.name, emailVerified: profile.email_verified === true });
    response.cookies.delete("kora_google_oauth_state");
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed.", error);
    return NextResponse.redirect(new URL("/auth?error=google_auth", request.url));
  }
}
