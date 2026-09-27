import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { canPerformAction } from "@/lib/security";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { createBusinessMemoryRecord, listBusinessMemoryRecords, updateBusinessMemoryRecord, deleteBusinessMemoryRecord, getBusinessMemoryRecord } from "@/lib/business-memory-records";

const recordTypes = ["lead", "expense", "project", "product", "service"] as const;
const schemas = {
  lead: z.object({ name: z.string().trim().min(2).max(160), company: z.string().trim().max(160).optional(), email: z.string().email().optional().or(z.literal("")), phone: z.string().trim().max(40).optional(), stage: z.enum(["new", "qualified", "proposal", "won", "lost"]).default("new"), value: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), followUpAt: z.string().datetime().optional(), notes: z.string().max(2000).optional() }),
  expense: z.object({ description: z.string().trim().min(2).max(200), amount: z.number().positive(), currency: z.string().length(3).default("NGN"), category: z.string().trim().min(2).max(80), supplier: z.string().trim().max(160).optional(), occurredAt: z.string().datetime(), paymentMethod: z.string().max(40).optional(), notes: z.string().max(2000).optional() }),
  project: z.object({ name: z.string().trim().min(2).max(160), status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]).default("planned"), customer: z.string().trim().max(160).optional(), startAt: z.string().datetime().optional(), dueAt: z.string().datetime().optional(), budget: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), progress: z.number().min(0).max(100).default(0), notes: z.string().max(2000).optional() }),
  product: z.object({ name: z.string().trim().min(2).max(160), sku: z.string().trim().max(80).optional(), price: z.number().nonnegative(), cost: z.number().nonnegative().optional(), currency: z.string().length(3).default("NGN"), stock: z.number().int().nonnegative().optional(), reorderLevel: z.number().int().nonnegative().optional(), notes: z.string().max(2000).optional() }),
  service: z.object({ name: z.string().trim().min(2).max(160), price: z.number().nonnegative(), currency: z.string().length(3).default("NGN"), billingUnit: z.string().trim().max(40).optional(), description: z.string().max(2000).optional() }),
};
const updateSchema = z.object({ title: z.string().trim().min(2).max(160).optional(), summary: z.string().trim().min(2).max(2000).optional(), data: z.record(z.string(), z.unknown()).optional(), status: z.string().max(40).optional() }).refine((v) => Object.keys(v).length > 0);

async function authorized(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id || user.organizationId !== session.organizationId) return { response: NextResponse.json({ error: "Active workspace membership could not be verified." }, { status: 403 }) };
  if (!isFirebaseAdminConfigured()) return { response: NextResponse.json({ error: "Operational record storage is not configured." }, { status: 503 }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  const type = request.nextUrl.searchParams.get("type");
  const records = await listBusinessMemoryRecords(auth.user.organizationId, 500);
  const team = canPerformAction(auth.user, "view_team_data") || canPerformAction(auth.user, "all_data_access");
  const visible = records.filter((r) => recordTypes.includes(r.entityType as typeof recordTypes[number]) && (!type || r.entityType === type) && (team || r.createdBy === auth.user.id));
  return NextResponse.json({ success: true, data: visible });
}

export async function POST(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.user, "view_team_data") && !canPerformAction(auth.user, "all_data_access")) return NextResponse.json({ error: "A workspace manager role is required to create shared operational records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !recordTypes.includes(body.entityType)) return NextResponse.json({ error: "Choose a supported operational record type." }, { status: 400 });
  const parsed = schemas[body.entityType as keyof typeof schemas].safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "The record fields are invalid.", details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  const data = parsed.data as Record<string, unknown>;
  const title = String((data as { name?: string; description?: string }).name ?? (data as { description?: string }).description);
  const summary = body.entityType === "expense" ? `${data.currency} ${data.amount} · ${data.category}` : body.entityType === "lead" ? `Lead · ${data.stage}${data.value == null ? "" : ` · ${data.currency} ${data.value}`}` : `${body.entityType} record · ${String(data.status ?? "active")}`;
  const record = await createBusinessMemoryRecord({ organizationId: auth.user.organizationId, createdBy: auth.user.id, entityType: body.entityType, title, summary, data, status: "active", source: "structured_application", verificationStatus: "verified", tags: [body.entityType] });
  return NextResponse.json({ success: true, data: record }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.user, "view_team_data") && !canPerformAction(auth.user, "all_data_access")) return NextResponse.json({ error: "A workspace manager role is required." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
  const current = await getBusinessMemoryRecord(auth.user.organizationId, id);
  if (!current || !recordTypes.includes(current.entityType as typeof recordTypes[number])) return NextResponse.json({ error: "Operational record not found." }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Enter valid record changes." }, { status: 400 });
  const record = await updateBusinessMemoryRecord(auth.user.organizationId, id, auth.user.id, parsed.data);
  return NextResponse.json({ success: true, data: record });
}

export async function DELETE(request: NextRequest) {
  const auth = await authorized(request); if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.user, "all_data_access")) return NextResponse.json({ error: "Only workspace owners and admins can delete shared operational records." }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id"); if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
  const current = await getBusinessMemoryRecord(auth.user.organizationId, id);
  if (!current || !recordTypes.includes(current.entityType as typeof recordTypes[number])) return NextResponse.json({ error: "Operational record not found." }, { status: 404 });
  const deleted = await deleteBusinessMemoryRecord(auth.user.organizationId, id, auth.user.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Operational record not found." }, { status: 404 });
}
