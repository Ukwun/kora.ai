import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { deleteOrganizationRecord, updateOrganizationRecord } from "@/lib/operations";
import { z } from "zod";

const invoiceUpdateSchema = z.object({
  number: z.string().trim().min(2).max(40).optional(),
  amount: z.coerce.number().positive().optional(),
  customerId: z.string().trim().min(1).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No permitted fields were supplied." });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only owners and admins can edit invoices" }, { status: 403 });
  const { id } = await context.params;
  const parsed = invoiceUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid invoice details." }, { status: 400 });
  const record = await updateOrganizationRecord("invoices", session.organizationId, id, parsed.data, session.id);
  return record ? NextResponse.json({ success: true, data: record }) : NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only owners and admins can delete invoices" }, { status: 403 });
  const { id } = await context.params;
  const deleted = await deleteOrganizationRecord("invoices", session.organizationId, id, session.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}
