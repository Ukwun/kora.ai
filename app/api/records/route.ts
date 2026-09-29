import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { canPerformAction } from "@/lib/security";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { createBusinessMemoryRecord, listBusinessMemoryRecords, updateBusinessMemoryRecord, deleteBusinessMemoryRecord, getBusinessMemoryRecord, listBusinessMemoryAuditHistory } from "@/lib/business-memory-records";

const recordTypes = ["lead", "expense", "project", "product", "service", "inventory", "quotation", "appointment", "meeting", "document"] as const;
const schemas = {
  lead: z.object({ name: z.string().trim().min(2).max(160), company: z.string().trim().max(160).optional(), email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(40).optional(), stage: z.enum(["new", "qualified", "proposal", "won", "lost"]).default("new"), value: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), followUpAt: z.string().datetime().optional(), notes: z.string().max(2000).optional() }),
  expense: z.object({ description: z.string().trim().min(2).max(200), amount: z.number().positive(), currency: z.string().length(3).default("NGN"), category: z.string().trim().min(2).max(80), supplier: z.string().trim().max(160).optional(), occurredAt: z.string().datetime(), paymentMethod: z.string().max(40).optional(), notes: z.string().max(2000).optional() }),
  project: z.object({ name: z.string().trim().min(2).max(160), status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]).default("planned"), customer: z.string().trim().max(160).optional(), startAt: z.string().datetime().optional(), dueAt: z.string().datetime().optional(), budget: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), progress: z.number().min(0).max(100).default(0), notes: z.string().max(2000).optional() }),
  product: z.object({ name: z.string().trim().min(2).max(160), sku: z.string().trim().max(80).optional(), price: z.number().nonnegative(), cost: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), stock: z.number().int().nonnegative().optional(), reorderLevel: z.number().int().nonnegative().optional(), notes: z.string().max(2000).optional() }),
  service: z.object({ name: z.string().trim().min(2).max(160), price: z.number().nonnegative(), currency: z.string().length(3).default("NGN"), billingUnit: z.string().trim().max(40).optional(), description: z.string().max(2000).optional() }),
  inventory: z.object({ name: z.string().trim().min(2).max(160), sku: z.string().trim().max(80).optional(), quantity: z.number().int().nonnegative(), reorderLevel: z.number().int().nonnegative(), unitCost: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), supplier: z.string().trim().max(160).optional() }),
  quotation: z.object({ number: z.string().trim().min(2).max(80), customer: z.string().trim().min(2).max(160), amount: z.number().positive(), currency: z.string().length(3).default("NGN"), status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).default("draft"), validUntil: z.string().datetime().optional(), lastFollowUpAt: z.string().datetime().optional(), notes: z.string().max(2000).optional() }),
  appointment: z.object({ title: z.string().trim().min(2).max(160), contact: z.string().trim().max(160).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), location: z.string().trim().max(240).optional(), status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"), notes: z.string().max(2000).optional() }),
  meeting: z.object({ title: z.string().trim().min(2).max(160), startsAt: z.string().datetime().optional(), attendees: z.array(z.string().trim().max(120)).max(30).default([]), notes: z.string().max(12000), decisions: z.array(z.string().trim().max(500)).max(30).default([]) }),
  document: z.object({ filename: z.string().trim().min(1).max(180), mimeType: z.enum(["text/plain", "text/csv", "application/json"]), extractedText: z.string().min(1).max(100000), tags: z.array(z.string().max(32)).max(12).default([]) }),
};
const updateSchema = z.object({ title: z.string().trim().min(2).max(160).optional(), summary: z.string().trim().min(2).max(2000).optional(), data: z.record(z.string(), z.unknown()).optional(), status: z.enum(["active", "inactive", "archived", "completed", "cancelled", "won", "lost", "draft", "sent", "accepted", "rejected", "expired", "scheduled", "no_show", "on_hold"]).optional() }).refine((v) => Object.keys(v).length > 0);

async function authorized(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id) return { response: NextResponse.json({ error: "Active workspace membership could not be verified." }, { status: 403 }) };
  if (!isFirebaseAdminConfigured()) return { response: NextResponse.json({ error: "Operational record storage is not configured." }, { status: 503 }) };
  return { user, session };
}

export async function GET(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const record = await getBusinessMemoryRecord(auth.session.organizationId, id);
    if (!record || !recordTypes.includes(record.entityType as typeof recordTypes[number])) return NextResponse.json({ error: "Operational record not found." }, { status: 404 });
    const canSeeTeam = canPerformAction(auth.session, "view_team_data") || canPerformAction(auth.session, "all_data_access");
    if (!canSeeTeam && record.createdBy !== auth.user.id) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const auditHistory = await listBusinessMemoryAuditHistory(auth.session.organizationId, id);
    return NextResponse.json({ success: true, data: record, auditHistory });
  }
  const records = await listBusinessMemoryRecords(auth.session.organizationId, 500);
  const team = canPerformAction(auth.session, "view_team_data") || canPerformAction(auth.session, "all_data_access");
  const visible = records.filter((r) => recordTypes.includes(r.entityType as typeof recordTypes[number]) && (!type || r.entityType === type) && (team || r.createdBy === auth.user.id));
  return NextResponse.json({ success: true, data: visible });
}

export async function POST(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.session, "view_team_data") && !canPerformAction(auth.session, "all_data_access")) return NextResponse.json({ error: "A workspace manager role is required to create shared operational records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !recordTypes.includes(body.entityType)) return NextResponse.json({ error: "Choose a supported operational record type." }, { status: 400 });
  const parsed = schemas[body.entityType as keyof typeof schemas].safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "The record fields are invalid.", details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const data = parsed.data as Record<string, unknown>;
  const title = String((data as { name?: string; description?: string; title?: string; number?: string; filename?: string }).name ?? (data as { title?: string }).title ?? (data as { number?: string }).number ?? (data as { filename?: string }).filename ?? (data as { description?: string }).description);
  if (body.entityType === "appointment" && data.endsAt && Date.parse(String(data.endsAt)) <= Date.parse(String(data.startsAt))) return NextResponse.json({ error: "Appointment end time must be after its start time." }, { status: 400 });
  if (body.entityType === "document") {
    const text = String(data.extractedText);
    data.indexedChunks = text.match(/[\s\S]{1,1800}/g) ?? [];
    data.wordCount = text.trim().split(/\s+/).length;
    data.indexedAt = new Date().toISOString();
  }
  const summary = body.entityType === "expense" ? `${data.currency} ${data.amount} · ${data.category}` : body.entityType === "lead" ? `Lead · ${data.stage}${data.value == null ? "" : ` · ${data.currency} ${data.value}`}` : `${body.entityType} record · ${String(data.status ?? "active")}`;
  const record = await createBusinessMemoryRecord({ organizationId: auth.session.organizationId, createdBy: auth.user.id, entityType: body.entityType, title, summary, data, status: "active", source: body.entityType === "document" ? "uploaded_document" : "structured_application", verificationStatus: "verified", tags: [body.entityType] });
  return NextResponse.json({ success: true, data: record }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.session, "view_team_data") && !canPerformAction(auth.session, "all_data_access")) return NextResponse.json({ error: "A workspace manager role is required." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
  const current = await getBusinessMemoryRecord(auth.session.organizationId, id);
  if (!current || !recordTypes.includes(current.entityType as typeof recordTypes[number])) return NextResponse.json({ error: "Operational record not found." }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Enter valid record changes." }, { status: 400 });
  const changes = { ...parsed.data };
  if (changes.data) {
    const validation = schemas[current.entityType as keyof typeof schemas].safeParse(changes.data);
    if (!validation.success) return NextResponse.json({ error: "The updated record fields are invalid.", details: validation.error.issues.map((issue) => issue.message) }, { status: 400 });
    changes.data = validation.data as Record<string, unknown>;
    if (current.entityType === "document") { const text = String(changes.data.extractedText); changes.data.indexedChunks = text.match(/[\s\S]{1,1800}/g) ?? []; changes.data.wordCount = text.trim().split(/\s+/).length; changes.data.indexedAt = new Date().toISOString(); }
  }
  const record = await updateBusinessMemoryRecord(auth.session.organizationId, id, auth.user.id, changes);
  return NextResponse.json({ success: true, data: record });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.session, "all_data_access")) return NextResponse.json({ error: "Only workspace owners and admins can delete shared operational records." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
  const current = await getBusinessMemoryRecord(auth.session.organizationId, id);
  if (!current || !recordTypes.includes(current.entityType as typeof recordTypes[number])) return NextResponse.json({ error: "Operational record not found." }, { status: 404 });
  const deleted = await deleteBusinessMemoryRecord(auth.session.organizationId, id, auth.user.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Operational record not found." }, { status: 404 });
}
