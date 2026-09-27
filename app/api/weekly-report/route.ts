import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail, readDatabase } from "@/lib/store";
import { canPerformAction } from "@/lib/security";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id || user.organizationId !== session.organizationId) return NextResponse.json({ error: "Active workspace membership could not be verified." }, { status: 403 });
  if (!canPerformAction(user, "view_reports") && !canPerformAction(user, "all_data_access")) return NextResponse.json({ error: "You do not have permission to view workspace reports." }, { status: 403 });

  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const db = await readDatabase();
  const orgId = user.organizationId;
  const scoped = <T extends { organizationId: string; createdBy?: string }>(rows: T[]) => rows.filter((row) => row.organizationId === orgId && (canPerformAction(user, "view_team_data") || canPerformAction(user, "all_data_access") || row.createdBy === user.id));
  const invoices = scoped(db.invoices);
  const customers = scoped(db.customers);
  const tasks = scoped(db.tasks);
  const thisWeek = (value: string) => new Date(value) >= start && new Date(value) <= now;
  const memory = isFirebaseAdminConfigured() ? await listBusinessMemoryRecords(orgId, 500) : [];
  const records = memory.filter((record) => canPerformAction(user, "view_team_data") || canPerformAction(user, "all_data_access") || record.createdBy === user.id);
  const ofType = (type: string) => records.filter((record) => record.entityType === type);
  const expenses = ofType("expense").filter((record) => thisWeek(String(record.data.occurredAt ?? record.createdAt)));
  const weeklyInvoices = invoices.filter((invoice) => thisWeek(invoice.createdAt));
  const paidAmount = weeklyInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const overdue = invoices.filter((invoice) => !["paid", "cancelled", "draft"].includes(invoice.status) && invoice.dueAt && new Date(invoice.dueAt) < now);
  const newCustomers = customers.filter((customer) => thisWeek(customer.createdAt));
  const weeklyTasks = tasks.filter((task) => thisWeek(task.createdAt));
  const projects = ofType("project").filter((record) => record.status !== "deleted");
  const leads = ofType("lead").filter((record) => record.status !== "deleted");
  const expenseTotal = expenses.reduce((sum, record) => sum + Number(record.data.amount ?? 0), 0);
  const won = leads.filter((lead) => lead.data.stage === "won").length;
  const lost = leads.filter((lead) => lead.data.stage === "lost").length;
  const report = {
    generatedAt: now.toISOString(), period: { start: start.toISOString(), end: now.toISOString(), label: "Week to date" },
    metrics: {
      paidInvoiceValue: { value: paidAmount, count: weeklyInvoices.filter((i) => i.status === "paid").length, source: "paid invoices created this week", available: true },
      outstandingInvoices: { value: invoices.filter((i) => !["paid", "cancelled"].includes(i.status)).length, overdueValue: overdue.reduce((sum, invoice) => sum + Number(invoice.amount), 0), source: "workspace invoice records", available: true },
      newCustomers: { value: newCustomers.length, source: "customer records created this week", available: true },
      tasksCompleted: { value: weeklyTasks.filter((task) => task.status === "done").length, totalCreated: weeklyTasks.length, source: "tasks created this week", available: true },
      expenses: { value: expenseTotal, count: expenses.length, currency: expenses[0]?.data.currency ?? "NGN", source: "expense records dated this week", available: expenses.length > 0, emptyReason: expenses.length ? undefined : "No expense records are available for this period." },
      leads: { value: leads.filter((lead) => thisWeek(lead.createdAt)).length, won, lost, source: "structured lead records", available: leads.length > 0, emptyReason: leads.length ? undefined : "No lead records are available." },
      projects: { value: projects.length, averageProgress: projects.length ? Math.round(projects.reduce((sum, project) => sum + Number(project.data.progress ?? 0), 0) / projects.length) : null, source: "structured project records", available: projects.length > 0, emptyReason: projects.length ? undefined : "No project records are available." },
      productsAndServices: { products: ofType("product").length, services: ofType("service").length, available: ofType("product").length + ofType("service").length > 0 },
    },
    evidence: { overdueInvoices: overdue.map((invoice) => ({ id: invoice.id, number: invoice.number, amount: Number(invoice.amount), dueAt: invoice.dueAt })), expenseRecordIds: expenses.map((record) => record.id), leadRecordIds: leads.map((record) => record.id), projectRecordIds: projects.map((record) => record.id) },
    caveat: "This report only includes records saved in this workspace. A zero or unavailable metric does not imply there was no real-world activity.",
  };
  return NextResponse.json({ success: true, data: report }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
