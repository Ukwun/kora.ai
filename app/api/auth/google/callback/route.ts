import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createOrganization, createUser, findUserByEmail } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

type GoogleTokenResponse = { access_token?: string; error?: string; error_description?: string };
type GoogleProfile = { email?: string; name?: string; email_verified?: boolean };

export async function GET(request: NextRequest) {
  const appUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("kora_google_oauth_state")?.value;
  if (!appUrl || !clientId || !clientSecret || !code || !state || state !== expectedState) {
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

    let user = await findUserByEmail(profile.email);
    if (!user) {
      const organization = await createOrganization({ name: `${(profile.name || profile.email).trim()}'s workspace`, industry: "Other", timezone: "Africa/Lagos", currency: "NGN" });
      user = await createUser({ name: profile.name?.trim() || profile.email.split("@")[0], email: profile.email, passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12), role: "owner", organizationId: organization.id });
    }

    const response = NextResponse.redirect(new URL("/onboarding", request.url));
    response.cookies.delete("kora_google_oauth_state");
    return setSessionCookie(response, { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
  } catch {
    return NextResponse.redirect(new URL("/auth?error=google_auth", request.url));
  }
}
