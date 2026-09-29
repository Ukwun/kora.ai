import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { canPerformAction } from "@/lib/security";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { createBusinessMemoryRecord, decideBusinessRecommendation, deleteBusinessMemoryRecord, getBusinessMemoryRecord, listBusinessMemoryAuditHistory, listBusinessMemoryRecords, MEMORY_ENTITY_TYPES, updateBusinessMemoryRecord, type BusinessMemoryRecord } from "@/lib/business-memory-records";
import { listOrganizationRecords } from "@/lib/operations";
import type { Customer, Invoice, Payment, Task } from "@/lib/store";

const createSchema = z.object({
  entityType: z.enum(MEMORY_ENTITY_TYPES),
  title: z.string().trim().min(2).max(140),
  summary: z.string().trim().min(2).max(3000),
  data: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).default([]),
  confirmed: z.literal(true),
}).refine((value) => Buffer.byteLength(JSON.stringify(value.data), "utf8") <= 24_000, { message: "Memory record data is too large." });

const updateSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  summary: z.string().trim().min(2).max(3000).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  status: z.enum(["active", "archived", "pending_approval", "approved", "rejected", "completed"]).optional(),
  verificationStatus: z.enum(["user_confirmed", "disputed"]).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Choose at least one field to update." });

async function getAuthorizedUser(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id) {
    return { response: NextResponse.json({ error: "Your active workspace membership could not be verified." }, { status: 403 }) };
  }
  return { session, user };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedUser(request);
  if ("response" in auth) return auth.response;
  const recordId = request.nextUrl.searchParams.get("id");
  if (recordId) {
    const record = isFirebaseAdminConfigured() ? await getBusinessMemoryRecord(auth.session.organizationId, recordId) : null;
    const canSeeTeam = canPerformAction(auth.session, "view_team_data") || canPerformAction(auth.session, "all_data_access");
    if (record) {
      if (!canSeeTeam && record.createdBy !== auth.user.id) return NextResponse.json({ error: "Access denied." }, { status: 403 });
      const auditHistory = await listBusinessMemoryAuditHistory(auth.session.organizationId, recordId);
      return NextResponse.json({ success: true, data: record, auditHistory });
    }
    const core = await Promise.all([
      listOrganizationRecords<Customer>("customers", auth.session.organizationId),
      listOrganizationRecords<Invoice>("invoices", auth.session.organizationId),
      listOrganizationRecords<Task>("tasks", auth.session.organizationId),
      listOrganizationRecords<Payment>("payments", auth.session.organizationId),
    ]);
    const rows = [...core[0].map((entry) => ({ id: `customer_${entry.id}`, entityType: "customer", title: entry.name, data: entry, createdBy: entry.createdBy, createdAt: entry.createdAt, updatedAt: entry.updatedAt })), ...core[1].map((entry) => ({ id: `invoice_${entry.id}`, entityType: "invoice", title: entry.number, data: entry, createdBy: entry.createdBy, createdAt: entry.createdAt, updatedAt: entry.updatedAt })), ...core[2].map((entry) => ({ id: `task_${entry.id}`, entityType: "task", title: entry.title, data: entry, createdBy: entry.createdBy, createdAt: entry.createdAt, updatedAt: entry.updatedAt })), ...core[3].map((entry) => ({ id: `payment_${entry.id}`, entityType: "payment", title: `Payment ${entry.providerReference ?? entry.id}`, data: entry, createdBy: "system", createdAt: entry.createdAt, updatedAt: entry.createdAt }))];
    const item = rows.find((entry) => entry.id === recordId);
    if (!item) return NextResponse.json({ error: "Memory record not found." }, { status: 404 });
    if (!canSeeTeam && item.createdBy !== auth.user.id) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    return NextResponse.json({ success: true, data: { ...item, organizationId: auth.session.organizationId, summary: `${item.entityType} record ${item.title}`, source: "structured_application", verificationStatus: "verified" }, auditHistory: [] });
  }
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Business memory storage is not configured for this deployment." }, { status: 503 });
  const records = await listBusinessMemoryRecords(auth.session.organizationId, 100);
  const visible = canPerformAction(auth.session, "view_team_data") || canPerformAction(auth.session, "all_data_access")
    ? records
    : records.filter((record) => record.createdBy === auth.user.id);
  return NextResponse.json({ success: true, data: visible });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedUser(request);
  if ("response" in auth) return auth.response;
  if (!canPerformAction(auth.session, "view_team_data") && !canPerformAction(auth.session, "all_data_access")) {
    return NextResponse.json({ error: "Only workspace managers can add shared business memory." }, { status: 403 });
  }
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Business memory storage is not configured for this deployment." }, { status: 503 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm a valid business memory entry before saving it." }, { status: 400 });

  const data = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key !== "confirmed")) as Pick<BusinessMemoryRecord, "entityType" | "title" | "summary" | "data" | "tags">;
  const record = await createBusinessMemoryRecord({
    ...data,
    organizationId: auth.session.organizationId,
    createdBy: auth.user.id,
    status: "active",
    source: "user_confirmed",
    verificationStatus: "user_confirmed",
  });
  return NextResponse.json({ success: true, data: record }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthorizedUser(request);
  if ("response" in auth) return auth.response;
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Business memory storage is not configured for this deployment." }, { status: 503 });
  const recordId = request.nextUrl.searchParams.get("id");
  if (!recordId) return NextResponse.json({ error: "A memory record ID is required." }, { status: 400 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid memory record changes." }, { status: 400 });

  const current = await getBusinessMemoryRecord(auth.session.organizationId, recordId);
  if (!current) return NextResponse.json({ error: "Memory record not found." }, { status: 404 });
  if (!canPerformAction(auth.session, "view_team_data") && !canPerformAction(auth.session, "all_data_access") && current.createdBy !== auth.user.id) {
    return NextResponse.json({ error: "You cannot edit another user's business memory." }, { status: 403 });
  }
  const decision = parsed.data.status;
  if (decision && ["approved", "rejected"].includes(decision)) {
    if (current.entityType !== "ai_recommendation") return NextResponse.json({ error: "Only recommendations can be approved or rejected." }, { status: 400 });
    if (!canPerformAction(auth.session, "all_data_access")) return NextResponse.json({ error: "Only owners and admins can approve AI recommendations." }, { status: 403 });
    const decisionChanges: Parameters<typeof updateBusinessMemoryRecord>[3] = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key !== "status"));
    const decisionResult = await decideBusinessRecommendation(auth.session.organizationId, recordId, auth.user.id, decision as "approved" | "rejected", decisionChanges);
    if (!decisionResult) return NextResponse.json({ error: "This recommendation is no longer awaiting a decision." }, { status: 409 });
    return NextResponse.json({ success: true, data: decisionResult.record, decision: decisionResult.decision });
  }
  const record = await updateBusinessMemoryRecord(auth.session.organizationId, recordId, auth.user.id, parsed.data);
  if (!record) return NextResponse.json({ error: "Memory record not found." }, { status: 404 });
  return NextResponse.json({ success: true, data: record });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthorizedUser(request);
  if ("response" in auth) return auth.response;
  if (!isFirebaseAdminConfigured()) return NextResponse.json({ error: "Business memory storage is not configured for this deployment." }, { status: 503 });
  const recordId = request.nextUrl.searchParams.get("id");
  if (!recordId) return NextResponse.json({ error: "A memory record ID is required." }, { status: 400 });
  const current = await getBusinessMemoryRecord(auth.session.organizationId, recordId);
  if (!current) return NextResponse.json({ error: "Memory record not found." }, { status: 404 });
  if (!canPerformAction(auth.session, "view_team_data") && !canPerformAction(auth.session, "all_data_access") && current.createdBy !== auth.user.id) {
    return NextResponse.json({ error: "You cannot delete another user's business memory." }, { status: 403 });
  }
  const deleted = await deleteBusinessMemoryRecord(auth.session.organizationId, recordId, auth.user.id);
  return deleted ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Memory record not found." }, { status: 404 });
}
