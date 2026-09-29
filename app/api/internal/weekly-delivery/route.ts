import { NextRequest, NextResponse } from "next/server";
import { readDatabase } from "@/lib/store";
import { listOrganizationRecords } from "@/lib/operations";
import { listBusinessMemoryRecords, createBusinessMemoryRecord } from "@/lib/business-memory-records";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";
import { logAudit } from "@/lib/security";
import type { Customer, Invoice, Task } from "@/lib/store";

export async function POST(request: NextRequest) {
  const secret = process.env.WEEKLY_REPORT_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isTransactionalEmailConfigured() || !isFirebaseAdminConfigured()) return NextResponse.json({ error: "Weekly delivery requires email and Firebase configuration." }, { status: 503 });
  const database = await readDatabase();
  let sent = 0;
  for (const organization of database.organizations) {
    const recipientIds = database.profiles.filter((profile) => profile.organizationId === organization.id && profile.reportingPreferences?.includes("weekly_summary")).map((profile) => profile.userId);
    const recipients = database.users.filter((user) => recipientIds.includes(user.id) && user.accountStatus === "active");
    if (!recipients.length) continue;
    const [invoices, customers, tasks, records] = await Promise.all([
      listOrganizationRecords<Invoice>("invoices", organization.id),
      listOrganizationRecords<Customer>("customers", organization.id),
      listOrganizationRecords<Task>("tasks", organization.id),
      listBusinessMemoryRecords(organization.id, 500),
    ]);
    const now = new Date(); const start = new Date(now); start.setUTCDate(start.getUTCDate() - 7);
    const within = (date: string) => Date.parse(date) >= start.getTime() && Date.parse(date) <= now.getTime();
    const paid = invoices.filter((item) => item.status === "paid" && within(item.updatedAt));
    const overdue = invoices.filter((item) => !["paid", "cancelled", "draft"].includes(item.status) && item.dueAt && Date.parse(item.dueAt) < now.getTime());
    const expenses = records.filter((item) => item.entityType === "expense" && within(String(item.data.occurredAt ?? item.createdAt)));
    const newCustomers = customers.filter((item) => within(item.createdAt));
    const completedTasks = tasks.filter((item) => item.status === "done" && within(item.updatedAt));
    const revenue = paid.reduce((sum, item) => sum + Number(item.amount), 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.data.amount ?? 0), 0);
    const report = { organizationId: organization.id, generatedAt: now.toISOString(), periodStart: start.toISOString(), periodEnd: now.toISOString(), currency: organization.currency, revenue, expenses: expenseTotal, overdueInvoices: overdue.map(({ id, number, amount, dueAt }) => ({ id, number, amount, dueAt })), newCustomerIds: newCustomers.map((item) => item.id), completedTaskIds: completedTasks.map((item) => item.id), unavailableMetrics: ["retention", "forecast", "lost customers", "top services"] };
    const memory = await createBusinessMemoryRecord({ organizationId: organization.id, createdBy: recipients[0].id, entityType: "report", title: `Weekly review ending ${now.toISOString().slice(0, 10)}`, summary: `${paid.length} paid invoices, ${overdue.length} overdue invoices, ${newCustomers.length} new customers, ${completedTasks.length} completed tasks, ${expenses.length} recorded expenses.`, data: report, source: "system_calculation", verificationStatus: "verified", status: "generated", tags: ["weekly_report"] });
    const fmt = (value: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: organization.currency, maximumFractionDigits: 0 }).format(value);
    const lines = [`Weekly business review: ${organization.name}`, `Period: ${start.toISOString().slice(0, 10)} to ${now.toISOString().slice(0, 10)}`, `Paid invoice value: ${fmt(revenue)} (${paid.length} invoices)`, `Recorded expenses: ${fmt(expenseTotal)} (${expenses.length} records)`, `Outstanding overdue: ${overdue.length} invoices (${fmt(overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0))})`, `New customers: ${newCustomers.length}`, `Tasks completed: ${completedTasks.length}`, "Unavailable: retention, forecasts, lost customers, top services (insufficient tracked data).", `Open the report in Kora: ${process.env.APP_URL ?? ""}/dashboard`];
    for (const recipient of recipients) {
      await sendTransactionalEmail({ to: recipient.email, subject: `Kora weekly review · ${organization.name}`, text: lines.join("\n"), html: `<h1>Weekly business review: ${organization.name}</h1><p>Period: ${start.toISOString().slice(0, 10)} – ${now.toISOString().slice(0, 10)}</p><ul>${lines.slice(2, 8).map((line) => `<li>${line}</li>`).join("")}</ul><p><a href="${process.env.APP_URL ?? ""}/dashboard">Open your Kora dashboard</a></p><small>Report record: ${memory.id}. Figures use saved workspace records only.</small>` });
      await logAudit({ userId: recipient.id, organizationId: organization.id, action: "data.create", resource: "weekly_report_email", resourceId: memory.id, status: "success", details: { recipient: recipient.email, periodStart: start.toISOString(), periodEnd: now.toISOString() } });
      sent++;
    }
  }
  return NextResponse.json({ success: true, sent });
}
