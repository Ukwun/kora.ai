import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { createBusinessMemoryRecord, listBusinessMemoryRecords, updateBusinessMemoryRecord } from "@/lib/business-memory-records";
import { notifyOrganization } from "@/lib/notifications";

const plans = {
  pilot: { label: "Pilot", monthlyVolume: 25, monthlyPrice: 25000 },
  steady: { label: "Steady growth", monthlyVolume: 100, monthlyPrice: 60000 },
  scale: { label: "Scale", monthlyVolume: 250, monthlyPrice: 125000 },
} as const;

const createSchema = z.object({ plan: z.enum(["pilot", "steady", "scale"]), acceptsTerms: z.literal(true) });
const updateSchema = z.object({ id: z.string().min(1), status: z.enum(["approved", "active", "paused", "cancelled", "rejected"]), note: z.string().trim().max(500).optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await listBusinessMemoryRecords(session.organizationId, 200);
  return NextResponse.json({ success: true, data: records.filter((record) => record.entityType === "lead_subscription" && (canPerformAction(session, "view_team_data") || record.createdBy === session.id)) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can request a lead subscription." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a plan and accept the lead-service terms." }, { status: 400 });
  const plan = plans[parsed.data.plan];
  const record = await createBusinessMemoryRecord({
    organizationId: session.organizationId,
    createdBy: session.id,
    entityType: "lead_subscription",
    title: `${plan.label} lead-service subscription request`,
    summary: `Subscription request for up to ${plan.monthlyVolume} prospects per month. No payment or lead delivery has started.`,
    data: { plan: parsed.data.plan, planLabel: plan.label, monthlyVolume: plan.monthlyVolume, monthlyPrice: plan.monthlyPrice, currency: "NGN", status: "pending_checkout", paymentStatus: "not_started", termsAcceptedAt: new Date().toISOString(), sourceDisclosureRequired: true, consentRequired: true, replacementPolicyRequired: true },
    status: "pending_checkout",
    source: "user_confirmed",
    verificationStatus: "user_confirmed",
    tags: ["lead-service", "subscription", "pending-checkout"],
  });
  await notifyOrganization({ organizationId: session.organizationId, actorUserId: session.id, event: "leadUpdate", title: "Lead subscription request saved", body: `${plan.label} lead-service subscription is awaiting checkout and compliance review.`, data: { subscriptionId: record.id } });
  return NextResponse.json({ success: true, data: record, checkoutRequired: true, message: "The request is saved. A configured payment checkout and supplier/compliance approval are required before activation." }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can update lead subscriptions." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription update." }, { status: 400 });
  const records = await listBusinessMemoryRecords(session.organizationId, 200);
  const current = records.find((record) => record.id === parsed.data.id && record.entityType === "lead_subscription");
  if (!current) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  const updated = await updateBusinessMemoryRecord(session.organizationId, current.id, session.id, { status: parsed.data.status, data: { ...current.data, status: parsed.data.status, adminNote: parsed.data.note, updatedAt: new Date().toISOString() } });
  return NextResponse.json({ success: true, data: updated });
}
