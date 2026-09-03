import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { createInvoice, listOrganizationRecords } from "@/lib/operations";
import type { Invoice } from "@/lib/store";
import { canPerformAction } from "@/lib/security";

const schema = z.object({ number: z.string().trim().min(2).max(40), amount: z.coerce.number().positive(), customerId: z.string().optional(), dueAt: z.string().datetime().optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return NextResponse.json({ success: true, data: await listOrganizationRecords<Invoice>("invoices", session.organizationId) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only owners and admins can create invoices" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid invoice number and amount." }, { status: 400 });
  const invoice = await createInvoice({ ...parsed.data, currency: "NGN", status: "draft", organizationId: session.organizationId, createdBy: session.id });
  return NextResponse.json({ success: true, data: invoice }, { status: 201 });
}
