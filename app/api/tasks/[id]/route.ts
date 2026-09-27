import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { deleteOrganizationRecord, updateOrganizationRecord } from "@/lib/operations";
import { listOrganizationRecords } from "@/lib/operations";
import type { Task } from "@/lib/store";
import { z } from "zod";

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  assignedTo: z.string().trim().min(1).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No permitted fields were supplied." });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "update_own_task") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const task = (await listOrganizationRecords<Task>("tasks", session.organizationId)).find((entry) => entry.id === id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canPerformAction(session, "view_team_data") && task.createdBy !== session.id && task.assignedTo !== session.id) return NextResponse.json({ error: "You can only update your own tasks." }, { status: 403 });
  const parsed = taskUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid task details." }, { status: 400 });
  const record = await updateOrganizationRecord("tasks", session.organizationId, id, parsed.data, session.id);
  return record ? NextResponse.json({ success: true, data: record }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const deleted = await deleteOrganizationRecord("tasks", session.organizationId, id, session.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Task not found" }, { status: 404 });
}
