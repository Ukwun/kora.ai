import type { NextRequest } from "next/server";
import { findUserByEmail } from "./store";
import { getSessionClaimsFromHeader, getSessionClaimsFromRequest, type SessionUser } from "./session-token";

export type { SessionUser } from "./session-token";
export { clearSessionCookie, setSessionCookie } from "./session-token";

async function getCurrentAccount(claims: SessionUser | null): Promise<SessionUser | null> {
  if (!claims) return null;
  const user = await findUserByEmail(claims.email);
  if (!user || user.accountStatus === "suspended" || user.id !== claims.id || user.organizationId !== claims.organizationId) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId };
}

export async function getSessionFromRequest(request: NextRequest) {
  return getCurrentAccount(await getSessionClaimsFromRequest(request));
}

export async function getSessionFromHeader(headers: Headers) {
  return getCurrentAccount(await getSessionClaimsFromHeader(headers));
}
