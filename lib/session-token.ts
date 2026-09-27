import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export type SessionUser = { id: string; name: string; email: string; role: string; organizationId: string };
type SessionPayload = SessionUser & { expiresAt: number };
const cookieName = "kora_session";

function secret() {
  const configured = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!configured || configured.length < 32)) throw new Error("SESSION_SECRET must be at least 32 characters in production");
  return (configured || "kora-session-secret-dev").padEnd(32, "0");
}
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");

export async function decodeSessionToken(raw: string): Promise<SessionUser | null> {
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  try {
    const content = Buffer.from(encoded, "base64url").toString("utf8");
    const payload = JSON.parse(content) as SessionPayload;
    const expected = sign(content);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer) || !payload.expiresAt || payload.expiresAt <= Date.now()) return null;
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role, organizationId: payload.organizationId };
  } catch { return null; }
}

export async function getSessionClaimsFromRequest(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  return token ? decodeSessionToken(token) : null;
}

export async function getSessionClaimsFromHeader(headers: Headers) {
  const token = headers.get("cookie")?.match(new RegExp(`${cookieName}=([^;]+)`))?.[1];
  return token ? decodeSessionToken(token) : null;
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  const maxAge = 60 * 60 * 24 * 7;
  const content = JSON.stringify({ ...user, expiresAt: Date.now() + maxAge * 1000 });
  const token = `${Buffer.from(content, "utf8").toString("base64url")}.${sign(content)}`;
  response.cookies.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
