import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { findOrganizationById } from "@/lib/store";
import { listOrganizationActivity, listOrganizationRecords } from "@/lib/operations";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";
import type { Customer, Invoice, Payment, Task } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can export workspace data." }, { status: 403 });
  const organization = await findOrganizationById(session.organizationId);
  const [customers, tasks, invoices, payments, activity, memory] = await Promise.all([
    listOrganizationRecords<Customer>("customers", session.organizationId),
    listOrganizationRecords<Task>("tasks", session.organizationId),
    listOrganizationRecords<Invoice>("invoices", session.organizationId),
    listOrganizationRecords<Payment>("payments", session.organizationId),
    listOrganizationActivity(session.organizationId),
    listBusinessMemoryRecords(session.organizationId, 500),
  ]);
  return NextResponse.json({ exportedAt: new Date().toISOString(), organization, customers, tasks, invoices, payments, activity, memory }, { headers: { "Content-Disposition": `attachment; filename="kora-${session.organizationId}-export.json"`, "Cache-Control": "private, no-store" } });
}
