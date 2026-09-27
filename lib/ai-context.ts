import type { BusinessUser, Organization } from "./store";
import { readDatabase } from "./store";
import { canPerformAction } from "./security";
import type { AIContext } from "./ai";

/** Build model context only from records the signed-in user is authorized to see. */
export async function buildAuthorizedAIContext(user: BusinessUser, organization: Organization): Promise<AIContext> {
  const database = await readDatabase();
  const canSeeTeam = canPerformAction(user, "view_team_data") || canPerformAction(user, "all_data_access");
  const visible = <T extends { organizationId: string }>(records: T[]) => records.filter((record) => record.organizationId === organization.id);
  const customers = visible(database.customers).filter((customer) => canSeeTeam || customer.createdBy === user.id);
  const invoices = visible(database.invoices).filter((invoice) => canSeeTeam || invoice.createdBy === user.id);
  const tasks = visible(database.tasks).filter((task) => canSeeTeam || task.createdBy === user.id || task.assignedTo === user.id);
  const activities = visible(database.activityEvents)
    .filter((event) => canSeeTeam || event.actorUserId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const overdueInvoices = invoices.filter((invoice) => !["paid", "cancelled", "draft"].includes(invoice.status) && invoice.dueAt && new Date(invoice.dueAt) < todayStart);
  const overdueTasks = tasks.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt) < todayStart);
  const dueTodayTasks = tasks.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt) >= todayStart && new Date(task.dueAt) < tomorrowStart);
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");

  return {
    user,
    organization,
    recentActivity: activities.map((event) => ({ label: event.type, detail: `${event.entityType}${event.entityId ? ` ${event.entityId}` : ""}`, time: event.createdAt })),
    memoryNodes: [],
    metrics: {
      revenue: paidInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      customers: customers.filter((customer) => customer.status === "active").length,
      tasks: tasks.filter((task) => task.status !== "done").length,
      retention: null,
    },
    evidence: {
      overdueInvoiceCount: overdueInvoices.length,
      overdueInvoiceAmount: overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      overdueTaskCount: overdueTasks.length,
      dueTodayTaskCount: dueTodayTasks.length,
      paidInvoiceCount: paidInvoices.length,
      overdueInvoices: overdueInvoices.map(({ id, number, dueAt, amount, customerId }) => ({ id, number, dueAt, amount: Number(amount), customerId })),
      overdueTasks: overdueTasks.map(({ id, title, dueAt, assignedTo }) => ({ id, title, dueAt, assignedTo })),
      dueTodayTasks: dueTodayTasks.map(({ id, title, dueAt, assignedTo }) => ({ id, title, dueAt, assignedTo })),
    },
  };
}
