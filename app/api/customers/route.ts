import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { createCustomer, listOrganizationRecords } from "@/lib/operations";
import type { Customer } from "@/lib/store";
import { canPerformAction } from "@/lib/security";

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(40).optional(), notes: z.string().trim().max(1000).optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data") && !canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  return NextResponse.json({ success: true, data: await listOrganizationRecords<Customer>("customers", session.organizationId) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_team_data") && !canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid customer name and email." }, { status: 400 });
  const customer = await createCustomer({ ...parsed.data, email: parsed.data.email || undefined, status: "active", organizationId: session.organizationId, createdBy: session.id });
  return NextResponse.json({ success: true, data: customer }, { status: 201 });
}
