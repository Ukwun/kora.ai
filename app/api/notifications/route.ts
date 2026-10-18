import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { getUserNotificationPreferences, saveUserNotificationPreferences } from "@/lib/notifications";
import { listBusinessMemoryRecords } from "@/lib/business-memory-records";

const schema = z.object({
  emailEnabled: z.boolean(),
  browserEnabled: z.boolean(),
  digest: z.enum(["daily", "weekly", "never"]),
  events: z.object({
    customerCreated: z.boolean(), overdueInvoice: z.boolean(), taskAssigned: z.boolean(), paymentFailed: z.boolean(),
    aiRecommendation: z.boolean(), integrationEvent: z.boolean(), leadUpdate: z.boolean(),
  }),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preferences = await getUserNotificationPreferences(session.id, session.organizationId);
  const records = await listBusinessMemoryRecords(session.organizationId, 100);
  const notifications = records.filter((record) => record.entityType === "notification" && record.data.recipientUserId === session.id).slice(0, 50);
  return NextResponse.json({ success: true, data: { preferences, notifications } }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_own_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid notification preferences." }, { status: 400 });
  const preferences = await saveUserNotificationPreferences(session.id, session.organizationId, parsed.data);
  return NextResponse.json({ success: true, data: preferences });
}
