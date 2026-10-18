import { NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/lib/store";
import { listOrganizationRecords } from "@/lib/operations";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";
import { notifyOrganization } from "@/lib/notifications";
import type { Invoice } from "@/lib/store";

export async function POST(request: NextRequest) {
  const secret = process.env.WEEKLY_REPORT_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = await readDatabase();
  const day = new Date().toISOString().slice(0, 10);
  let notified = 0;
  for (const organization of database.organizations) {
    const invoices = await listOrganizationRecords<Invoice>("invoices", organization.id);
    const overdue = invoices.filter((invoice) => !["paid", "cancelled", "draft"].includes(invoice.status) && invoice.dueAt && Date.parse(invoice.dueAt) < Date.now());
    if (!overdue.length) continue;
    const existing = await listBusinessMemoryRecords(organization.id, 200);
    if (existing.some((record) => record.entityType === "notification" && record.data.event === "overdueInvoice" && record.data.digestDate === day)) continue;
    await notifyOrganization({ organizationId: organization.id, event: "overdueInvoice", title: `${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}`, body: `${overdue.length} invoice${overdue.length === 1 ? " is" : "s are"} past due and need review.`, data: { digestDate: day, invoiceIds: overdue.map((invoice) => invoice.id) } });
    notified++;
  }
  return NextResponse.json({ success: true, notified });
}
