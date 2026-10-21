import { createHmac } from "node:crypto";

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createWhatsAppOAuthState(userId: string, organizationId: string) {
  const value = `${userId}.${organizationId}.${Date.now() + 10 * 60_000}`;
  return `${Buffer.from(value).toString("base64url")}.${sign(value)}`;
}

export function verifyWhatsAppOAuthState(state: string, userId: string, organizationId: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return false;
  const value = Buffer.from(encoded, "base64url").toString("utf8");
  const [stateUser, stateOrganization, expiry] = value.split(".");
  return signature === sign(value) && stateUser === userId && stateOrganization === organizationId && Number(expiry) > Date.now();
}
