import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOAuthBaseUrl, signInWithVerifiedOAuthEmail } from "@/lib/social-auth";

type AppleTokenResponse = { id_token?: string; error?: string; error_description?: string };
type AppleClaims = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iss?: string;
  nonce?: string;
  sub?: string;
};
type AppleJwk = { kid?: unknown; kty?: unknown; use?: unknown; n?: unknown; e?: unknown };

function createAppleClientSecret(clientId: string) {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!teamId || !keyId || !privateKey) throw new Error("Apple sign-in is not configured.");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
    aud: "https://appleid.apple.com",
    sub: clientId,
  })).toString("base64url");
  const content = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(content), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return `${content}.${signature}`;
}

async function verifyAppleIdentityToken(identityToken: string, clientId: string, expectedNonce: string) {
  const [encodedHeader, encodedClaims, encodedSignature] = identityToken.split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature) throw new Error("Apple returned an invalid identity token.");

  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Apple returned an unsupported identity token.");

  const keysResponse = await fetch("https://appleid.apple.com/auth/keys", { cache: "no-store" });
  const keySet = await keysResponse.json() as { keys?: AppleJwk[] };
  const jwk = keySet.keys?.find((key) => key.kid === header.kid && key.kty === "RSA" && (!key.use || key.use === "sig"));
  if (!keysResponse.ok || !jwk || typeof jwk.n !== "string" || typeof jwk.e !== "string") {
    throw new Error("Apple's signing key could not be verified.");
  }

  const validSignature = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    createPublicKey({ key: { kty: "RSA", n: jwk.n, e: jwk.e }, format: "jwk" }),
    Buffer.from(encodedSignature, "base64url"),
  );
  if (!validSignature) throw new Error("Apple returned an invalid identity signature.");

  const claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as AppleClaims;
  const audienceMatches = claims.aud === clientId || (Array.isArray(claims.aud) && claims.aud.includes(clientId));
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== "https://appleid.apple.com" ||
    !audienceMatches ||
    !claims.sub ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    !claims.nonce ||
    claims.nonce !== expectedNonce
  ) {
    throw new Error("Apple's identity token did not match this sign-in request.");
  }
  return claims;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const code = form.get("code");
    const state = form.get("state");
    const expectedState = request.cookies.get("kora_apple_oauth_state")?.value;
    const expectedNonce = request.cookies.get("kora_apple_oauth_nonce")?.value;
    const appUrl = getOAuthBaseUrl(request);
    const clientId = process.env.APPLE_CLIENT_ID;
    const clientSecret = clientId ? createAppleClientSecret(clientId) : "";
    if (
      form.has("error") ||
      typeof code !== "string" ||
      typeof state !== "string" ||
      state !== expectedState ||
      !expectedNonce ||
      !clientId
    ) {
      return NextResponse.redirect(new URL("/auth?error=apple_auth", request.url));
    }

    const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${appUrl}/api/auth/apple/callback`,
      }),
      cache: "no-store",
    });
    const token = await tokenResponse.json() as AppleTokenResponse;
    if (!tokenResponse.ok || !token.id_token) {
      throw new Error(token.error_description || token.error || "Apple token exchange failed.");
    }

    const claims = await verifyAppleIdentityToken(token.id_token, clientId, expectedNonce);
    if (!claims.email || (claims.email_verified !== true && claims.email_verified !== "true")) {
      throw new Error("Apple did not return a verified email address.");
    }

    let name: string | undefined;
    const rawUser = form.get("user");
    if (typeof rawUser === "string") {
      const appleUser = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } };
      name = [appleUser.name?.firstName, appleUser.name?.lastName].filter(Boolean).join(" ");
    }

    const response = await signInWithVerifiedOAuthEmail(request, {
      email: claims.email,
      name,
      emailVerified: true,
    });
    response.cookies.delete("kora_apple_oauth_state");
    response.cookies.delete("kora_apple_oauth_nonce");
    return response;
  } catch (error) {
    console.error("Apple OAuth callback failed.", error);
    return NextResponse.redirect(new URL("/auth?error=apple_auth", request.url));
  }
}
