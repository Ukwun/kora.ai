import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction, logAudit } from "@/lib/security";
import { createWhatsAppMessage, listWhatsAppMessages, updateWhatsAppMessage } from "@/lib/whatsapp-storage";

const createSchema = z.object({ connectionId: z.string().min(1), customerId: z.string().optional(), toPhone: z.string().trim().min(7).max(30), body: z.string().trim().min(1).max(4096), consentStatus: z.literal("opted_in") });
const updateSchema = z.object({ id: z.string().min(1), decision: z.enum(["approved", "rejected"]) });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_team_data")) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  try { return NextResponse.json({ success: true, data: await listWhatsAppMessages(session.organizationId) }); } catch { return NextResponse.json({ error: "WhatsApp persistence is not available until PostgreSQL is configured." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can queue outbound WhatsApp messages." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Outbound WhatsApp messages require explicit customer opt-in and a valid message." }, { status: 400 });
  try {
    const message = await createWhatsAppMessage({ organizationId: session.organizationId, connectionId: parsed.data.connectionId, customerId: parsed.data.customerId, toPhone: parsed.data.toPhone, body: parsed.data.body, direction: "outbound", status: "pending_approval", consentStatus: parsed.data.consentStatus, createdBy: session.id });
    await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.create", resource: "whatsapp_message", resourceId: message.id, status: "success", details: { direction: "outbound", status: "pending_approval", consentStatus: parsed.data.consentStatus } });
    return NextResponse.json({ success: true, data: message, message: "Message queued for human approval. Kora has not sent it." }, { status: 201 });
  } catch { return NextResponse.json({ error: "WhatsApp persistence is not available until PostgreSQL is configured." }, { status: 503 }); }
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can approve outbound WhatsApp messages." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
  try {
    const message = await updateWhatsAppMessage(parsed.data.id, session.organizationId, { status: parsed.data.decision === "approved" ? "approved" : "rejected" });
    if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.update", resource: "whatsapp_message", resourceId: message.id, status: "success", details: { decision: parsed.data.decision } });
    return NextResponse.json({ success: true, data: message, message: parsed.data.decision === "approved" ? "Message approved and queued for the dispatcher." : "Message rejected. It will not be sent." });
  } catch { return NextResponse.json({ error: "WhatsApp persistence is not available until PostgreSQL is configured." }, { status: 503 }); }
}
