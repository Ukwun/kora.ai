import type { Customer, Invoice, Task } from "./store";

export type BriefingItem = {
  id: string;
  level: "urgent" | "attention" | "positive";
  title: string;
  detail: string;
  action?: "invoices" | "tasks" | "customers";
  evidence?: Array<{ id: string; title: string }>;
};

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function buildDailyBriefing(records: {
  customers: Customer[];
  invoices: Invoice[];
  tasks: Task[];
  memory?: Array<{ id: string; entityType: string; title: string; status: string; data: Record<string, unknown>; createdAt: string }>;
}, now = new Date()) {
  const today = dayStart(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const overdueInvoices = records.invoices.filter((invoice) =>
    !["paid", "cancelled", "draft"].includes(invoice.status) &&
    invoice.dueAt && new Date(invoice.dueAt) < today
  );
  const dueTasks = records.tasks.filter((task) =>
    task.status !== "done" && task.dueAt && new Date(task.dueAt) >= today && new Date(task.dueAt) < tomorrow
  );
  const overdueTasks = records.tasks.filter((task) =>
    task.status !== "done" && task.dueAt && new Date(task.dueAt) < today
  );
  const newCustomers = records.customers.filter((customer) => new Date(customer.createdAt) >= today);
  const items: BriefingItem[] = [];

  if (overdueInvoices.length) {
    const amount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    items.push({ id: "overdue-invoices", level: "urgent", title: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} overdue`, detail: `${new Intl.NumberFormat("en-NG", { style: "currency", currency: overdueInvoices[0].currency || "NGN", maximumFractionDigits: 0 }).format(amount)} across ${overdueInvoices.map((invoice) => invoice.number).join(", ")}.`, action: "invoices" });
  }
  if (overdueTasks.length) items.push({ id: "overdue-tasks", level: "urgent", title: `${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} past due`, detail: overdueTasks.slice(0, 3).map((task) => task.title).join(", ") + (overdueTasks.length > 3 ? ` and ${overdueTasks.length - 3} more` : "."), action: "tasks" });
  if (dueTasks.length) items.push({ id: "due-tasks", level: "attention", title: `${dueTasks.length} task${dueTasks.length === 1 ? "" : "s"} due today`, detail: dueTasks.slice(0, 3).map((task) => task.title).join(", ") + (dueTasks.length > 3 ? ` and ${dueTasks.length - 3} more` : "."), action: "tasks" });
  if (newCustomers.length) items.push({ id: "new-customers", level: "positive", title: `${newCustomers.length} new customer${newCustomers.length === 1 ? "" : "s"} today`, detail: newCustomers.map((customer) => customer.name).join(", ") + ".", action: "customers" });
  const memory = records.memory ?? [];
  const overdueLeadFollowUps = memory.filter((record) => record.entityType === "lead" && !["won", "lost", "deleted"].includes(String(record.data.stage)) && typeof record.data.followUpAt === "string" && Date.parse(String(record.data.followUpAt)) < today.getTime());
  if (overdueLeadFollowUps.length) items.push({ id: "overdue-lead-follow-ups", level: "attention", title: `${overdueLeadFollowUps.length} lead follow-up${overdueLeadFollowUps.length === 1 ? "" : "s"} past due`, detail: overdueLeadFollowUps.slice(0, 4).map((lead) => lead.title).join(", "), evidence: overdueLeadFollowUps.slice(0, 10).map(({ id, title }) => ({ id, title })) });
  const lowStock = memory.filter((record) => (record.entityType === "product" || record.entityType === "inventory") && typeof (record.data.stock ?? record.data.quantity) === "number" && typeof record.data.reorderLevel === "number" && Number(record.data.stock ?? record.data.quantity) <= Number(record.data.reorderLevel));
  if (lowStock.length) items.push({ id: "low-stock", level: "urgent", title: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} at or below reorder level`, detail: lowStock.slice(0, 4).map((item) => `${item.title} (${item.data.stock ?? item.data.quantity} remaining; reorder at ${item.data.reorderLevel})`).join(". "), evidence: lowStock.slice(0, 10).map(({ id, title }) => ({ id, title })) });
  const staleQuotes = memory.filter((record) => record.entityType === "quotation" && record.data.status === "sent" && !record.data.lastFollowUpAt && Date.parse(record.createdAt) < now.getTime() - 7 * 86_400_000);
  if (staleQuotes.length) items.push({ id: "stale-quotes", level: "attention", title: `${staleQuotes.length} sent quotation${staleQuotes.length === 1 ? "" : "s"} have no recorded follow-up`, detail: `These quotations have been in sent status for more than seven days without a follow-up date recorded: ${staleQuotes.slice(0, 4).map((quote) => quote.title).join(", ")}. This reflects Kora's recorded data only.`, evidence: staleQuotes.slice(0, 10).map(({ id, title }) => ({ id, title })) });
  const expenseRecords = memory.filter((record) => record.entityType === "expense");
  const currentWindow = expenseRecords.filter((record) => Date.parse(String(record.data.occurredAt ?? record.createdAt)) >= now.getTime() - 7 * 86_400_000);
  const previousWindow = expenseRecords.filter((record) => { const time = Date.parse(String(record.data.occurredAt ?? record.createdAt)); return time >= now.getTime() - 14 * 86_400_000 && time < now.getTime() - 7 * 86_400_000; });
  if (currentWindow.length >= 2 && previousWindow.length >= 2) {
    const currencies = new Set([...currentWindow, ...previousWindow].map((record) => String(record.data.currency ?? "NGN")));
    const currentTotal = currentWindow.reduce((sum, record) => sum + Number(record.data.amount ?? 0), 0);
    const previousTotal = previousWindow.reduce((sum, record) => sum + Number(record.data.amount ?? 0), 0);
    if (currencies.size === 1 && previousTotal > 0 && currentTotal >= previousTotal * 1.2) items.push({ id: "expense-increase", level: "attention", title: "Recorded expenses are higher this week", detail: `${currentWindow.length} recorded expenses total ${Math.round((currentTotal / previousTotal - 1) * 100)}% more than the prior seven-day period. This is a change in recorded spend, not an explanation of its cause.`, evidence: [...currentWindow, ...previousWindow].slice(0, 10).map(({ id, title }) => ({ id, title })) });
  }

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekTasks = records.tasks.filter((task) => new Date(task.createdAt) >= weekStart);
  const weekCustomers = records.customers.filter((customer) => new Date(customer.createdAt) >= weekStart);
  const weekInvoices = records.invoices.filter((invoice) => new Date(invoice.createdAt) >= weekStart);
  const weekPaid = weekInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  return {
    generatedAt: now.toISOString(),
    source: "workspace_records",
    items,
    emptyMessage: "No urgent actions found in the records currently tracked. Keep leads, quotations, expenses, inventory, and tasks up to date to improve this view.",
    weekly: {
      periodStart: weekStart.toISOString(),
      periodEnd: now.toISOString(),
      revenueRecorded: weekPaid,
      invoicesCreated: weekInvoices.length,
      outstandingInvoices: records.invoices.filter((invoice) => !["paid", "cancelled"].includes(invoice.status)).length,
      newCustomers: weekCustomers.length,
      tasksCompleted: weekTasks.filter((task) => task.status === "done").length,
      tasksCreated: weekTasks.length,
      tasksDelayed: records.tasks.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt) < today).length,
      unavailableMetrics: ["expenses", "leads", "deals", "projects", "services"],
    },
  };
}
