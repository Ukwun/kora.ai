import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { createTask, listOrganizationRecords } from "@/lib/operations";
import type { Task } from "@/lib/store";
import { canPerformAction } from "@/lib/security";

const schema = z.object({ title: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).optional(), priority: z.enum(["low", "medium", "high"]).default("medium"), assignedTo: z.string().optional(), dueAt: z.string().datetime().optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const tasks = await listOrganizationRecords<Task>("tasks", session.organizationId);
  return NextResponse.json({ success: true, data: canPerformAction(session, "view_team_data") ? tasks : tasks.filter((task) => task.createdBy === session.id || task.assignedTo === session.id) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "create_task")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid task title." }, { status: 400 });
  const task = await createTask({ ...parsed.data, status: "todo", organizationId: session.organizationId, createdBy: session.id });
  return NextResponse.json({ success: true, data: task }, { status: 201 });
}
