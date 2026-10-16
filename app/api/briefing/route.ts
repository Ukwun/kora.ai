import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { readDatabase } from "@/lib/store";
import { buildDailyBriefing } from "@/lib/daily-briefing";
import { canPerformAction } from "@/lib/security";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";
import { getBusinessProfile } from "@/lib/business-memory";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const database = await readDatabase();
  const organizationId = session.organizationId;
  const teamAccess = canPerformAction(session, "view_team_data") || canPerformAction(session, "all_data_access");
  const visibleCustomers = database.customers.filter((customer) => customer.organizationId === organizationId && (teamAccess || customer.createdBy === session.id));
  const visibleInvoices = database.invoices.filter((invoice) => invoice.organizationId === organizationId && (teamAccess || invoice.createdBy === session.id));
  const visibleTasks = database.tasks.filter((task) => task.organizationId === organizationId &&
    (teamAccess || task.createdBy === session.id || task.assignedTo === session.id));
  const memory = await listBusinessMemoryRecords(organizationId, 500);
  const visibleMemory = memory.filter((record) => teamAccess || record.createdBy === session.id);
  const profile = await getBusinessProfile(session.id, organizationId);
  const briefing = buildDailyBriefing({
    customers: visibleCustomers,
    invoices: visibleInvoices,
    tasks: visibleTasks,
    memory: visibleMemory,
    profile: { mainChallenge: profile?.mainChallenge },
  });

  return NextResponse.json({ success: true, data: briefing }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
