import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction, logAudit } from "@/lib/security";
import { postgresEnabled, query } from "@/lib/db";

const createSchema = z.object({ name: z.string().trim().min(1).max(100), language: z.string().trim().min(2).max(20), category: z.enum(["marketing", "utility", "authentication"]), body: z.string().trim().min(1).max(1024) });
const reviewSchema = z.object({ id: z.string().min(1), decision: z.enum(["approved", "rejected"]), reviewNote: z.string().trim().max(500).optional() });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  if (!postgresEnabled) return NextResponse.json({ error: "WhatsApp templates require PostgreSQL." }, { status: 503 });
  const result = await query(`SELECT id, name, language, category, body, status, provider_template_id AS "providerTemplateId", review_note AS "reviewNote", created_at AS "createdAt", updated_at AS "updatedAt" FROM whatsapp_templates WHERE organization_id=$1 ORDER BY created_at DESC`, [session.organizationId]);
  return NextResponse.json({ success: true, data: result.rows });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can submit templates." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid WhatsApp template." }, { status: 400 });
  if (!postgresEnabled) return NextResponse.json({ error: "WhatsApp templates require PostgreSQL." }, { status: 503 });
  const id = `wat_${randomUUID()}`;
  await query(`INSERT INTO whatsapp_templates (id, organization_id, name, language, category, body, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,'pending_approval',$7)`, [id, session.organizationId, parsed.data.name, parsed.data.language, parsed.data.category, parsed.data.body, session.id]);
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.create", resource: "whatsapp_template", resourceId: id, status: "success", details: { status: "pending_approval" } });
  return NextResponse.json({ success: true, id, message: "Template submitted for review. Meta approval is still required before production use." }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can review templates." }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid template review." }, { status: 400 });
  if (!postgresEnabled) return NextResponse.json({ error: "WhatsApp templates require PostgreSQL." }, { status: 503 });
  const result = await query(`UPDATE whatsapp_templates SET status=$3, reviewed_by=$4, review_note=$5, updated_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING id, status`, [parsed.data.id, session.organizationId, parsed.data.decision, session.id, parsed.data.reviewNote ?? null]);
  if (!result.rows[0]) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.update", resource: "whatsapp_template", resourceId: parsed.data.id, status: "success", details: { decision: parsed.data.decision } });
  return NextResponse.json({ success: true, data: result.rows[0] });
}
