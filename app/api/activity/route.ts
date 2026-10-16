import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { listOrganizationActivity } from "@/lib/operations";
import { canPerformAction } from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const teamAccess = canPerformAction(session, "view_team_data") || canPerformAction(session, "all_data_access");
  const events = await listOrganizationActivity(session.organizationId);
  const visibleEvents = events
    .filter((event) => teamAccess || event.actorUserId === session.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return NextResponse.json({ success: true, data: visibleEvents });
}
