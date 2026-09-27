import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { canPerformAction, getClientIP, logAudit } from "@/lib/security";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";

const emailSchema = z.object({
  recipients: z.array(z.string().email()).min(1).max(20),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  confirmed: z.literal(true),
});

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id || user.organizationId !== session.organizationId) return NextResponse.json({ error: "Active workspace membership could not be verified." }, { status: 403 });
  if (!canPerformAction(user, "all_data_access")) return NextResponse.json({ error: "Only workspace owners and admins can send email." }, { status: 403 });
  if (!isTransactionalEmailConfigured()) return NextResponse.json({ error: "Email delivery is unavailable until RESEND_API_KEY and EMAIL_FROM are configured." }, { status: 503 });
  const parsed = emailSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm a valid email with recipients before sending." }, { status: 400 });
  try {
    const result = await sendTransactionalEmail({ to: parsed.data.recipients, subject: parsed.data.subject, text: parsed.data.body, html: `<div style="white-space:pre-wrap">${escapeHtml(parsed.data.body)}</div>` });
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "data.create", resource: "email", resourceId: result.id, status: "success", details: { recipientCount: parsed.data.recipients.length, subject: parsed.data.subject, source: "user_confirmed" }, ipAddress: getClientIP(request) });
    return NextResponse.json({ success: true, messageId: result.id, sentAt: new Date().toISOString(), status: "sent" });
  } catch (error) {
    await logAudit({ userId: user.id, organizationId: user.organizationId, action: "error", resource: "email", status: "failure", details: { error: error instanceof Error ? error.message : "delivery failed" }, ipAddress: getClientIP(request) });
    return NextResponse.json({ error: "Email could not be delivered." }, { status: 502 });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
