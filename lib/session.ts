import { NextRequest, NextResponse } from "next/server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
};

const cookieName = "kora_session";
const secret = (process.env.SESSION_SECRET || "kora-session-secret-dev").padEnd(32, "0");

async function signValue(value: string) {
  const textEncoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", keyMaterial, textEncoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

async function encodeSession(payload: SessionUser) {
  const raw = JSON.stringify(payload);
  return `${encodeBase64Url(raw)}.${await signValue(raw)}`;
}

async function decodeSession(rawValue: string) {
  const [encoded, sig] = rawValue.split(".");
  if (!encoded || !sig) return null;

  try {
    const decoded = decodeBase64Url(encoded);
    const payload = JSON.parse(decoded) as SessionUser;
    const expected = await signValue(decoded);
    if (sig !== expected) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  const value = await encodeSession(user);
  response.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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
