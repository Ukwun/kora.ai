import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { readDatabase } from "@/lib/store";
import { canPerformAction } from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const database = await readDatabase();
  const events = database.activityEvents.filter((event) => event.organizationId === session.organizationId);
  return NextResponse.json({ success: true, data: events.slice(-50).reverse() });
}
