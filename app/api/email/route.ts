import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, recipients, subject, body: emailBody, type } = body;

    const user = await findUserByEmail(session.email);
    if (!user) {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Email error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
