import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTask } from "@/lib/operations";
import { getPlatformAdminRequest } from "@/lib/platform-admin";
import { checkDistributedRateLimit } from "@/lib/security";
import { notifyOrganization } from "@/lib/notifications";
import { readDatabase } from "@/lib/store";

const schema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const access = await getPlatformAdminRequest(request);
  if ("response" in access) return access.response;
  if (!(await checkDistributedRateLimit(`platform_admin_task_${access.session.id}`, 30, 60))) {
    return NextResponse.json({ error: "Too many task assignments. Try again shortly." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a business and provide a valid task title." }, { status: 400 });
  const database = await readDatabase();
  if (!database.organizations.some((organization) => organization.id === parsed.data.organizationId)) {
    return NextResponse.json({ error: "Business workspace not found." }, { status: 404 });
  }

  let assignedUser: (typeof database.users)[number] | undefined;
  if (parsed.data.assignedTo) {
    assignedUser = database.users.find((user) =>
      user.id === parsed.data.assignedTo && user.accountStatus === "active",
    );
    const activeMembership = assignedUser && database.memberships.some((membership) =>
      membership.organizationId === parsed.data.organizationId &&
      membership.status === "active" &&
      (membership.userId === assignedUser?.id || membership.email.toLowerCase() === assignedUser?.email.toLowerCase()),
    );
    if (!assignedUser || !activeMembership) {
      return NextResponse.json({ error: "Assign this task to an active member of the selected business." }, { status: 400 });
    }
  }

  const task = await createTask({
    organizationId: parsed.data.organizationId,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    assignedTo: assignedUser?.id,
    dueAt: parsed.data.dueAt,
    status: "todo",
    createdBy: access.session.id,
  });
  await notifyOrganization({
    organizationId: parsed.data.organizationId,
    actorUserId: access.session.id,
    userIds: assignedUser ? [assignedUser.id] : undefined,
    event: "taskAssigned",
    title: assignedUser ? "A platform admin assigned you a task" : "A platform admin added a task",
    body: `${task.title}${task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString("en-NG")}` : ""}`,
    data: { taskId: task.id, source: "platform_admin" },
  });
  return NextResponse.json({ success: true, data: task, message: "The task was added to the business workspace and the assignee was notified." }, { status: 201 });
}
