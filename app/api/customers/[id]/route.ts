import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { deleteOrganizationRecord, updateOrganizationRecord } from "@/lib/operations";
import { z } from "zod";

const customerUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["active", "inactive", "at_risk"]).optional(),
  notes: z.string().trim().max(2000).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No permitted fields were supplied." });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_team_data") && !canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const parsed = customerUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid customer details." }, { status: 400 });
  const record = await updateOrganizationRecord("customers", session.organizationId, id, parsed.data, session.id);
  return record ? NextResponse.json({ success: true, data: record }) : NextResponse.json({ error: "Customer not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { id } = await context.params;
  const deleted = await deleteOrganizationRecord("customers", session.organizationId, id, session.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Customer not found" }, { status: 404 });
}
