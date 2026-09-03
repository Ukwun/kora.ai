import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { createPayment, listOrganizationRecords } from "@/lib/operations";
import type { Payment } from "@/lib/store";
import { canPerformAction } from "@/lib/security";

const schema = z.object({ amount: z.coerce.number().positive(), invoiceId: z.string().optional(), customerId: z.string().optional(), provider: z.string().trim().min(2).max(40), providerReference: z.string().trim().max(120).optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return NextResponse.json({ success: true, data: await listOrganizationRecords<Payment>("payments", session.organizationId) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only owners and admins can record payments" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid payment amount and provider." }, { status: 400 });
  const payment = await createPayment({ ...parsed.data, currency: "NGN", status: "received", receivedAt: new Date().toISOString(), organizationId: session.organizationId });
  return NextResponse.json({ success: true, data: payment }, { status: 201 });
}
