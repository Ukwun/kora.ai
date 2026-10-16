import { NextRequest, NextResponse } from "next/server";
import { getOAuthBaseUrl, signInWithVerifiedOAuthEmail } from "@/lib/social-auth";

type FacebookTokenResponse = { access_token?: string; error?: { message?: string } };
type FacebookProfile = { id?: string; name?: string; email?: string };

export async function GET(request: NextRequest) {
  let appUrl: string;
  try {
    appUrl = getOAuthBaseUrl(request);
  } catch {
    return NextResponse.redirect(new URL("/auth?error=oauth_not_configured", request.url));
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("kora_facebook_oauth_state")?.value;
  if (request.nextUrl.searchParams.has("error") || !appId || !appSecret || !code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/auth?error=facebook_auth", request.url));
  }

  try {
    const callbackUrl = `${appUrl}/api/auth/facebook/callback`;
    const tokenUrl = new URL("https://graph.facebook.com/oauth/access_token");
    tokenUrl.search = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: callbackUrl,
      code,
    }).toString();
    const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
    const token = await tokenResponse.json() as FacebookTokenResponse;
    if (!tokenResponse.ok || !token.access_token) throw new Error(token.error?.message || "Facebook token exchange failed.");

    const graphVersion = process.env.FACEBOOK_GRAPH_API_VERSION || "v23.0";
    if (!/^v\d+\.\d+$/.test(graphVersion)) throw new Error("FACEBOOK_GRAPH_API_VERSION is invalid.");
    const profileResponse = await fetch(`https://graph.facebook.com/${graphVersion}/me?fields=id,name,email`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    const profile = await profileResponse.json() as FacebookProfile;
    if (!profileResponse.ok || !profile.id || !profile.email) {
      throw new Error("Facebook did not return an email address. Grant the email permission and try again.");
    }

    const response = await signInWithVerifiedOAuthEmail(request, {
      email: profile.email,
      name: profile.name,
      emailVerified: true,
    });
    response.cookies.delete("kora_facebook_oauth_state");
    return response;
  } catch (error) {
    console.error("Facebook OAuth callback failed.", error);
    return NextResponse.redirect(new URL("/auth?error=facebook_auth", request.url));
  }
}
