import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import type { Customer, Invoice, Payment, Task } from "@/lib/store";
import { listOrganizationRecords } from "@/lib/operations";
import { canPerformAction, checkRateLimit } from "@/lib/security";

const windows = {
  week: (now: Date) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return date; },
  month: (now: Date) => new Date(now.getFullYear(), now.getMonth(), 1),
  year: (now: Date) => new Date(now.getFullYear(), 0, 1),
} as const;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_reports") && !canPerformAction(session, "view_own_data") && !canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  if (!checkRateLimit(`analytics_${session.id}`, 60, 60)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const teamAccess = canPerformAction(session, "view_team_data") || canPerformAction(session, "all_data_access");
  const [customerRows, taskRows, invoiceRows, paymentRows] = await Promise.all([
    listOrganizationRecords<Customer>("customers", session.organizationId),
    listOrganizationRecords<Task>("tasks", session.organizationId),
    listOrganizationRecords<Invoice>("invoices", session.organizationId),
    listOrganizationRecords<Payment>("payments", session.organizationId),
  ]);
  const customers = customerRows.filter((record) => teamAccess || record.createdBy === session.id);
  const tasks = taskRows.filter((record) => teamAccess || record.createdBy === session.id || record.assignedTo === session.id);
  const invoices = invoiceRows.filter((record) => teamAccess || record.createdBy === session.id);
  const payments = paymentRows.filter((payment) => teamAccess || invoices.some((invoice) => invoice.id === payment.invoiceId));
  const now = new Date();
  const periods = Object.fromEntries(Object.entries(windows).map(([name, startOf]) => {
    const start = startOf(now);
    const relevantPayments = payments.filter((payment) => payment.status === "received" && payment.receivedAt && new Date(payment.receivedAt) >= start && new Date(payment.receivedAt) <= now);
    const relevantCustomers = customers.filter((customer) => new Date(customer.createdAt) >= start && new Date(customer.createdAt) <= now);
    const relevantTasks = tasks.filter((task) => new Date(task.createdAt) >= start && new Date(task.createdAt) <= now);
    const relevantInvoices = invoices.filter((invoice) => new Date(invoice.createdAt) >= start && new Date(invoice.createdAt) <= now);
    return [name, { revenue: relevantPayments.length ? relevantPayments.reduce((sum, payment) => sum + Number(payment.amount), 0) : null, customers: relevantCustomers.length, tasks: relevantTasks.length, invoices: relevantInvoices.length, payments: relevantPayments.length, coverage: { payments: relevantPayments.length > 0, customers: true, tasks: true, invoices: true } }];
  }));
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const overdue = invoices.filter((invoice) => !["paid", "cancelled", "draft"].includes(invoice.status) && invoice.dueAt && new Date(invoice.dueAt) < now);
  const analytics = {
    organizationId: session.organizationId,
    generatedAt: now.toISOString(),
    periods,
    trends: { revenueGrowth: null, customerGrowth: null, taskEfficiency: null, paymentHealth: null },
    topMetrics: {
      avgInvoiceValue: paidInvoices.length ? paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0) / paidInvoices.length : null,
      overdueInvoiceCount: overdue.length,
      overdueInvoiceValue: overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      averageDaysOverdue: overdue.length ? Math.round(overdue.reduce((sum, invoice) => sum + Math.floor((now.getTime() - new Date(invoice.dueAt as string).getTime()) / 86_400_000), 0) / overdue.length) : null,
      customerRetention: null,
      teamProductivity: null,
    },
    activeCustomers: customers.filter((customer) => customer.status === "active").length,
    openTasks: tasks.filter((task) => task.status !== "done").length,
    paidInvoiceCount: paidInvoices.length,
    dataLimits: ["Revenue uses received payment records with a receivedAt date; trend comparisons, retention, and productivity are not calculated from available records."],
  };
  return NextResponse.json({ success: true, data: analytics }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
