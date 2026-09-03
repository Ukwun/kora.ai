import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { deleteOrganizationRecord, updateOrganizationRecord } from "@/lib/operations";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "update_own_task") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const changes = await request.json().catch(() => null);
  if (!changes || typeof changes !== "object") return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const record = await updateOrganizationRecord("tasks", session.organizationId, id, changes);
  return record ? NextResponse.json({ success: true, data: record }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const deleted = await deleteOrganizationRecord("tasks", session.organizationId, id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
}
