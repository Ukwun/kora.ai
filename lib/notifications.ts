import { createBusinessMemoryRecord } from "./business-memory-records";
import { getOrCreateBusinessProfile } from "./business-memory";
import { readDatabase, saveBusinessProfile, type BusinessUser } from "./store";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "./email-provider";

export type NotificationEvent = "customerCreated" | "overdueInvoice" | "taskAssigned" | "paymentFailed" | "aiRecommendation" | "integrationEvent" | "leadUpdate";

export type NotificationPreferences = NonNullable<Awaited<ReturnType<typeof getOrCreateBusinessProfile>>["notificationPreferences"]>;

export const defaultNotificationPreferences: NotificationPreferences = {
  emailEnabled: true,
  browserEnabled: true,
  digest: "weekly",
  events: {
    customerCreated: true,
    overdueInvoice: true,
    taskAssigned: true,
    paymentFailed: true,
    aiRecommendation: true,
    integrationEvent: true,
    leadUpdate: true,
  },
};

export async function getUserNotificationPreferences(userId: string, organizationId: string) {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);
  return { ...defaultNotificationPreferences, ...profile.notificationPreferences, events: { ...defaultNotificationPreferences.events, ...profile.notificationPreferences?.events } };
}

export async function saveUserNotificationPreferences(userId: string, organizationId: string, preferences: NotificationPreferences) {
  const profile = await getOrCreateBusinessProfile(userId, organizationId);
  profile.notificationPreferences = preferences;
  profile.updatedAt = new Date().toISOString();
  await saveBusinessProfile(profile);
  return preferences;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}

function recipientsFor(database: Awaited<ReturnType<typeof readDatabase>>, organizationId: string, userIds?: string[]) {
  return database.users.filter((user) => user.organizationId === organizationId && user.accountStatus === "active" && (!userIds || userIds.includes(user.id)));
}

export async function notifyOrganization(input: {
  organizationId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  actorUserId?: string;
  userIds?: string[];
  data?: Record<string, unknown>;
}) {
  const database = await readDatabase();
  const recipients = recipientsFor(database, input.organizationId, input.userIds);
  let emailed = 0;
  for (const recipient of recipients) {
    const preferences = await getUserNotificationPreferences(recipient.id, input.organizationId);
    if (!preferences.events[input.event]) continue;
    const record = await createBusinessMemoryRecord({
      organizationId: input.organizationId,
      createdBy: input.actorUserId ?? recipient.id,
      entityType: "notification",
      title: input.title,
      summary: input.body,
      data: { event: input.event, recipientUserId: recipient.id, channel: "in_app", ...input.data },
      status: "unread",
      source: "system_calculation",
      verificationStatus: "verified",
      tags: ["notification", input.event],
    });
    if (preferences.emailEnabled && isTransactionalEmailConfigured()) {
      try {
        await sendTransactionalEmail({
          to: recipient.email,
          subject: `Kora · ${input.title}`,
          text: `${input.body}\n\nOpen your Kora workspace: ${process.env.APP_URL ?? ""}/dashboard`,
          html: `<p>${escapeHtml(input.body)}</p><p><a href="${escapeHtml(process.env.APP_URL ?? "")}/dashboard">Open your Kora workspace</a></p><small>Notification: ${escapeHtml(record.id)}</small>`,
        });
        emailed++;
      } catch (error) {
        console.error("Notification email delivery failed.", error);
      }
    }
  }
  return { recipients: recipients.length, emailed };
}

export function isUser(user: BusinessUser | undefined): user is BusinessUser {
  return Boolean(user?.id);
}
