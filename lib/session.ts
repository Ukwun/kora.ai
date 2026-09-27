import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
};

type SessionPayload = SessionUser & {
  expiresAt: number;
};

const cookieName = "kora_session";

function getSessionSecret() {
  // Read this only while serving a request. Reading it during module initialization
  // allows build tooling to evaluate and cache a production secret.
  const configuredSecret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production");
  }
  return (configuredSecret || "kora-session-secret-dev").padEnd(32, "0");
}

async function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

async function encodeSession(payload: SessionPayload) {
  const raw = JSON.stringify(payload);
  return `${encodeBase64Url(raw)}.${await signValue(raw)}`;
}

async function decodeSession(rawValue: string): Promise<SessionUser | null> {
  const [encoded, sig] = rawValue.split(".");
  if (!encoded || !sig) return null;

  try {
    const decoded = decodeBase64Url(encoded);
    const payload = JSON.parse(decoded) as SessionPayload;
    const expected = await signValue(decoded);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const signatureBuffer = Buffer.from(sig, "utf8");
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer) || !payload.expiresAt || payload.expiresAt <= Date.now()) return null;
    return { id: payload.id, name: payload.name, email: payload.email, role: payload.role, organizationId: payload.organizationId };
  } catch {
    return null;
  }
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  const maxAge = 60 * 60 * 24 * 7;
  const value = await encodeSession({ ...user, expiresAt: Date.now() + maxAge * 1000 });
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getSessionFromRequest(request: NextRequest) {
  const raw = request.cookies.get(cookieName)?.value;
  if (!raw) return null;
  return await decodeSession(raw);
}

export async function getSessionFromHeader(headers: Headers) {
  const cookieHeader = headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  const raw = cookieMatch?.[1];
  if (!raw) return null;
  return await decodeSession(raw);
}
