import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await listBusinessMemoryRecords(session.organizationId, 200);
  return NextResponse.json({ success: true, data: records.filter((record) => record.entityType === "lead_subscription" && (canPerformAction(session, "view_team_data") || record.createdBy === session.id)), deprecated: true });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can manage lead-service requests." }, { status: 403 });
  return NextResponse.json({ error: "Monthly lead subscriptions have been retired. Submit a package availability review with a complete targeting brief instead." }, { status: 410 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can manage lead-service requests." }, { status: 403 });
  return NextResponse.json({ error: "Monthly lead subscriptions are no longer supported." }, { status: 410 });
}
