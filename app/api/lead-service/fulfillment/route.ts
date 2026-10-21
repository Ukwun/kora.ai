import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { createBusinessMemoryRecord, listBusinessMemoryRecords, updateBusinessMemoryRecord } from "@/lib/business-memory-records";
import { notifyOrganization } from "@/lib/notifications";
import { getLeadComplianceRule, leadQualityCriteria } from "@/lib/lead-compliance";

const createSchema = z.object({
  subscriptionId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  company: z.string().trim().max(160).optional(),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  country: z.string().trim().min(2).max(80),
  region: z.string().trim().max(100).optional(),
  source: z.string().trim().min(3).max(240),
  sourceEvidence: z.string().trim().min(3).max(1000),
  consentStatus: z.enum(["explicit", "legitimate_interest", "not_verified"]),
  consentEvidence: z.string().trim().min(3).max(1000),
  optOutMethod: z.string().trim().min(3).max(240),
  qualityScore: z.coerce.number().int().min(1).max(5),
  replacementEligible: z.boolean(),
  complianceChecked: z.literal(true),
  deliveryStatus: z.enum(["queued", "sent"]).default("queued"),
});

const updateSchema = z.object({ id: z.string().min(1), deliveryStatus: z.enum(["queued", "sent", "rejected", "replaced"]), note: z.string().trim().max(500).optional() });

function canFulfill(session: { email: string; role: string; id: string; organizationId: string }) {
  const configuredAdmin = process.env.LEAD_ADMIN_EMAIL?.trim().toLowerCase();
  return canPerformAction(session, "all_data_access") && (!configuredAdmin || session.email.toLowerCase() === configuredAdmin);
}

function currentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canFulfill(session)) return NextResponse.json({ error: "Only the configured lead fulfillment administrator can view this queue." }, { status: 403 });
  const records = await listBusinessMemoryRecords(session.organizationId, 500);
  return NextResponse.json({ success: true, data: records.filter((record) => ["lead_request", "lead_subscription", "lead_delivery"].includes(record.entityType)) });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canFulfill(session)) return NextResponse.json({ error: "Only the configured lead fulfillment administrator can add leads." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Every lead needs source, consent, opt-out, quality, and compliance evidence." }, { status: 400 });
  const records = await listBusinessMemoryRecords(session.organizationId, 500);
  const subscription = records.find((record) => record.id === parsed.data.subscriptionId && record.entityType === "lead_subscription" && record.status === "active");
  if (!subscription) return NextResponse.json({ error: "An active lead subscription is required before importing leads." }, { status: 409 });
  const quota = Number(subscription.data.monthlyVolume ?? 0);
  const used = records.filter((record) => record.entityType === "lead_delivery" && record.data.subscriptionId === subscription.id && currentMonth(record.createdAt) && ["queued", "sent", "replaced"].includes(record.status)).length;
  if (!quota || used >= quota) return NextResponse.json({ error: `This subscription has reached its monthly quota of ${quota} leads.` }, { status: 409 });
  if (parsed.data.consentStatus !== "explicit") return NextResponse.json({ error: "Lead delivery requires explicit consent evidence. Do not import cold or unverified contacts." }, { status: 400 });
  const compliance = getLeadComplianceRule(parsed.data.country);
  if (compliance.consent !== "explicit") return NextResponse.json({ error: `This region requires manual compliance review before delivery. Rule set: ${compliance.version}.` }, { status: 409 });
  if (parsed.data.qualityScore < 3) return NextResponse.json({ error: `Lead quality must be at least 3/5. Criteria: ${leadQualityCriteria.join("; ")}.` }, { status: 400 });
  const lead = await createBusinessMemoryRecord({
    organizationId: session.organizationId,
    createdBy: session.id,
    entityType: "lead_delivery",
    title: `${parsed.data.name}${parsed.data.company ? ` · ${parsed.data.company}` : ""}`,
    summary: `Lead queued from ${parsed.data.source}. Consent and opt-out evidence recorded; this is not a guaranteed result.`,
    data: { ...parsed.data, subscriptionId: subscription.id, deliveryStatus: parsed.data.deliveryStatus, importedBy: session.email, adminEmail: process.env.LEAD_ADMIN_EMAIL ?? session.email, importedAt: new Date().toISOString(), complianceRule: compliance, qualityCriteria: leadQualityCriteria, replacementPolicy: parsed.data.replacementEligible ? compliance.refundPolicy : "No replacement promised.", refundPolicy: compliance.refundPolicy },
    status: parsed.data.deliveryStatus,
    source: "integration",
    verificationStatus: "user_confirmed",
    tags: ["lead-service", "fulfillment", parsed.data.country.toLowerCase()],
  });
  await notifyOrganization({ organizationId: session.organizationId, actorUserId: session.id, userIds: [subscription.createdBy], event: "leadUpdate", title: "Lead fulfillment updated", body: `${parsed.data.name} was added to your lead-service delivery queue.`, data: { leadId: lead.id, subscriptionId: subscription.id } });
  return NextResponse.json({ success: true, data: { lead, used: used + 1, quota } }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canFulfill(session)) return NextResponse.json({ error: "Only the configured lead fulfillment administrator can update delivery." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead delivery update." }, { status: 400 });
  const records = await listBusinessMemoryRecords(session.organizationId, 500);
  const current = records.find((record) => record.id === parsed.data.id && record.entityType === "lead_delivery");
  if (!current) return NextResponse.json({ error: "Lead delivery record not found." }, { status: 404 });
  const updated = await updateBusinessMemoryRecord(session.organizationId, current.id, session.id, { status: parsed.data.deliveryStatus, data: { ...current.data, deliveryStatus: parsed.data.deliveryStatus, adminNote: parsed.data.note, updatedAt: new Date().toISOString() } });
  return NextResponse.json({ success: true, data: updated });
}
