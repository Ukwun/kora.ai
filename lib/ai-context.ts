import type { BusinessUser, Organization } from "./store";
import { findBusinessProfile, type Customer, type Invoice, type Task } from "./store";
import { listOrganizationActivity, listOrganizationRecords } from "./operations";
import { canPerformAction } from "./security";
import type { AIContext } from "./ai";

/** Build model context only from records the signed-in user is authorized to see. */
export async function buildAuthorizedAIContext(user: BusinessUser, organization: Organization): Promise<AIContext> {
  const [customersAll, invoicesAll, tasksAll, activitiesAll, businessProfile] = await Promise.all([
    listOrganizationRecords<Customer>("customers", organization.id),
    listOrganizationRecords<Invoice>("invoices", organization.id),
    listOrganizationRecords<Task>("tasks", organization.id),
    listOrganizationActivity(organization.id),
    findBusinessProfile(user.id, organization.id),
  ]);
  const canSeeTeam = canPerformAction(user, "view_team_data") || canPerformAction(user, "all_data_access");
  const customers = customersAll.filter((customer) => canSeeTeam || customer.createdBy === user.id);
  const invoices = invoicesAll.filter((invoice) => canSeeTeam || invoice.createdBy === user.id);
  const tasks = tasksAll.filter((task) => canSeeTeam || task.createdBy === user.id || task.assignedTo === user.id);
  const activities = activitiesAll
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
    businessProfile: businessProfile ? {
      businessName: businessProfile.businessName,
      industry: businessProfile.industry,
      country: businessProfile.country,
      currency: businessProfile.currency,
      timezone: businessProfile.timezone,
      employees: businessProfile.employees,
      customersPerMonth: businessProfile.customersPerMonth,
      monthlyRevenueRange: businessProfile.monthlyRevenueRange,
      offerings: businessProfile.offerings,
      goals: businessProfile.goals,
      mainChallenge: businessProfile.mainChallenge,
      source: businessProfile.profileSource ?? "legacy_profile",
      updatedAt: businessProfile.profileUpdatedAt ?? businessProfile.updatedAt,
    } : null,
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
