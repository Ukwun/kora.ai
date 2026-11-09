import { NextRequest, NextResponse } from "next/server";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";
import { checkDistributedRateLimit } from "@/lib/security";
import { getPlatformAdminRequest } from "@/lib/platform-admin";
import { readDatabase, type ActivityEvent } from "@/lib/store";

function recordText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(request: NextRequest) {
  const access = await getPlatformAdminRequest(request);
  if ("response" in access) return access.response;
  if (!(await checkDistributedRateLimit(`platform_admin_overview_${access.session.id}`, 30, 60))) {
    return NextResponse.json({ error: "Too many platform overview requests. Try again shortly." }, { status: 429 });
  }

  const database = await readDatabase();
  const organizations = database.organizations;
  const userById = new Map(database.users.map((user) => [user.id, user]));
  const membershipByOrganization = new Map<string, typeof database.memberships>();
  for (const membership of database.memberships) {
    const entries = membershipByOrganization.get(membership.organizationId) ?? [];
    entries.push(membership);
    membershipByOrganization.set(membership.organizationId, entries);
  }
  const memoryByOrganization = await Promise.all(organizations.map(async (organization) => ({
    organizationId: organization.id,
    records: await listBusinessMemoryRecords(organization.id, 500),
  })));
  const memoryRecords = memoryByOrganization.flatMap(({ organizationId, records }) => records.map((record) => ({ organizationId, record })));
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const activeUsers = database.users.filter((user) => user.accountStatus === "active");
  const businessSummaries = organizations.map((organization) => {
    const memberships = membershipByOrganization.get(organization.id) ?? [];
    const members = new Map<string, { id: string; name: string; email: string; role: string }>();
    for (const membership of memberships) {
      if (membership.status !== "active") continue;
      const user = membership.userId ? userById.get(membership.userId) : database.users.find((candidate) => candidate.email.toLowerCase() === membership.email.toLowerCase());
      if (user?.accountStatus === "active") members.set(user.id, { id: user.id, name: user.name, email: user.email, role: membership.role });
    }
    for (const user of activeUsers) {
      if (user.organizationId === organization.id && !members.has(user.id)) {
        members.set(user.id, { id: user.id, name: user.name, email: user.email, role: user.role });
      }
    }
    const tasks = database.tasks.filter((task) => task.organizationId === organization.id);
    const organizationRecords = memoryRecords.filter((entry) => entry.organizationId === organization.id).map((entry) => entry.record);
    const subscriptions = database.billingSubscriptions.filter((subscription) =>
      subscription.organizationId === organization.id && ["active", "trial"].includes(subscription.status),
    );
    const complaints = organizationRecords.filter((record) => record.entityType === "complaint");
    const activities = database.activityEvents.filter((event) => event.organizationId === organization.id);
    return {
      id: organization.id,
      name: organization.name,
      industry: organization.industry,
      createdAt: organization.createdAt,
      userCount: members.size,
      subscriberCount: subscriptions.length,
      taskCount: tasks.length,
      taskTakerCount: new Set(tasks.map((task) => task.assignedTo).filter((id): id is string =>
        Boolean(id && userById.get(id)?.accountStatus === "active"),
      )).size,
      complaintCount: complaints.length,
      lastActivityAt: activities.reduce<string | undefined>((latest, event) => !latest || event.createdAt > latest ? event.createdAt : latest, undefined),
      members: [...members.values()],
    };
  });

  const now = new Date();
  const dayKeys = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (13 - index));
    return day.toISOString().slice(0, 10);
  });
  const series = dayKeys.map((date) => {
    const tasks = database.tasks.filter((task) => task.createdAt.startsWith(date)).length;
    const activities = database.activityEvents.filter((event) => event.createdAt.startsWith(date)).length;
    const businesses = organizations.filter((organization) => organization.createdAt.startsWith(date)).length;
    return {
      date,
      label: new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }),
      tasks,
      activities,
      businesses,
    };
  });

  const activityItems = database.activityEvents.map((event: ActivityEvent) => {
    const organization = organizationById.get(event.organizationId);
    const payload = event.payload;
    const title = recordText(payload.title, `${event.type.replace(/[._-]+/g, " ")} · ${event.entityType}`);
    const summary = recordText(payload.summary, recordText(payload.description, `${event.entityType.replace(/[._-]+/g, " ")} activity recorded in ${organization?.name ?? "a business"}.`));
    return {
      id: event.id,
      type: event.type,
      entityType: event.entityType,
      title,
      summary,
      organizationId: event.organizationId,
      organizationName: organization?.name ?? "Business workspace",
      actorName: event.actorName ?? userById.get(event.actorUserId)?.name,
      createdAt: event.createdAt,
    };
  });
  const recordItems = memoryRecords
    .filter(({ record }) => ["complaint", "lead_request", "lead_delivery", "lead_subscription"].includes(record.entityType))
    .map(({ organizationId, record }) => ({
      id: record.id,
      type: record.entityType === "complaint" ? "complaint.submitted" : `${record.entityType}.updated`,
      entityType: record.entityType,
      title: record.title,
      summary: record.summary,
      organizationId,
      organizationName: organizationById.get(organizationId)?.name ?? "Business workspace",
      actorName: userById.get(record.createdBy)?.name,
      createdAt: record.createdAt,
    }));
  const recentActivities = [...activityItems, ...recordItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 60);
  const allComplaints = memoryRecords
    .filter(({ record }) => record.entityType === "complaint")
    .map(({ organizationId, record }) => ({
      id: record.id,
      organizationId,
      organizationName: organizationById.get(organizationId)?.name ?? "Business workspace",
      title: record.title,
      summary: record.summary,
      category: recordText(record.data.category, "other"),
      status: record.status,
      submittedBy: recordText(record.data.submittedByName, userById.get(record.createdBy)?.name ?? "Business user"),
      createdAt: record.createdAt,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const complaints = allComplaints.slice(0, 100);
  const truncatedBusinesses = memoryByOrganization.filter(({ records }) => records.length >= 500).length;
  const todayKey = now.toISOString().slice(0, 10);

  return NextResponse.json({
    success: true,
    adminRole: access.adminRole,
    data: {
      generatedAt: now.toISOString(),
      metrics: {
        users: activeUsers.length,
        businesses: organizations.length,
        subscribers: database.billingSubscriptions.filter((subscription) => ["active", "trial"].includes(subscription.status)).length,
        tasks: database.tasks.length,
        taskTakers: new Set(database.tasks.map((task) => task.assignedTo).filter((id): id is string =>
          Boolean(id && userById.get(id)?.accountStatus === "active"),
        )).size,
        complaints: allComplaints.length,
        activitiesToday: database.activityEvents.filter((event) => event.createdAt.startsWith(todayKey)).length,
      },
      series,
      businesses: businessSummaries,
      recentActivities,
      complaints,
      dataWarnings: truncatedBusinesses
        ? [`Complaint and lead-service records may be incomplete for ${truncatedBusinesses} business(es) because their latest 500 records were returned.`]
        : [],
    },
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
