import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "./session";
import { getPlatformAdminRole } from "./platform-admin-roles";

export { getPlatformAdminRole, isPlatformAdmin } from "./platform-admin-roles";

export async function getPlatformAdminRequest(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminRole = getPlatformAdminRole(session.email);
  if (!adminRole) {
    return { response: NextResponse.json({ error: "Platform administrator access required." }, { status: 403 }) };
  }
  return { session, adminRole };
}
