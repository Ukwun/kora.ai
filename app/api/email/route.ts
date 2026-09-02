import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  sanitizeInput,
  getSafeErrorMessage,
} from "@/lib/security";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    await logAudit({
      userId: "anonymous",
      organizationId: "unknown",
      action: "permission.denied",
      resource: "email",
      status: "failure",
      details: { reason: "No session" },
      ipAddress: getClientIP(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Rate limiting - 30 email requests per minute
    const rateLimitKey = `email_${session.id}`;
    if (!checkRateLimit(rateLimitKey, 30, 60)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "email",
        status: "failure",
        details: { reason: "Rate limit exceeded" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Verify organization access
    if (!canAccessOrganization(session, session.organizationId)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "email",
        status: "failure",
        details: { reason: "Organization access denied" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { action, recipients, subject, body: emailBody, type } = body;

    // Sanitize inputs
    subject = sanitizeInput(String(subject), 200);
    emailBody = sanitizeInput(String(emailBody), 5000);
    action = sanitizeInput(String(action), 50);

    const user = await findUserByEmail(session.email);
    if (!user) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "error",
        resource: "email",
        status: "failure",
        details: { reason: "User not found" },
      });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Simulate email sending
    const result = {
      success: true,
      messageId: `msg_${Date.now()}`,
      action,
      type,
      recipients,
      subject,
      sentAt: new Date().toISOString(),
      status: "sent",
    };

    // In production, integrate with SendGrid, Postmark, AWS SES, etc.
    // For now, log to console
    console.log("Email sent:", {
      from: user.email,
      to: recipients,
      subject,
      body: emailBody,
      timestamp: new Date().toISOString(),
    });

    // Log email operation
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "data.create",
      resource: "email",
      status: "success",
      details: { recipients, subject, type },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Email error:", error);

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "error",
      resource: "email",
      status: "failure",
      details: { error: String(error) },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    );
  }
}
