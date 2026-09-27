import type { Customer, Invoice, Task } from "./store";

export type BriefingItem = {
  id: string;
  level: "urgent" | "attention" | "positive";
  title: string;
  detail: string;
  action?: "invoices" | "tasks" | "customers";
};

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function buildDailyBriefing(records: {
  customers: Customer[];
  invoices: Invoice[];
  tasks: Task[];
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
    emptyMessage: "No urgent actions found in the records currently tracked. Add leads, expenses, and project data as those workflows become available to widen this view.",
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
