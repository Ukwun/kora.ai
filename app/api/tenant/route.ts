import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { getTenantSnapshot } from "@/lib/tenant";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  canPerformAction,
  getSafeErrorMessage,
} from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    await logAudit({
      userId: "anonymous",
      organizationId: "unknown",
      action: "permission.denied",
      resource: "tenant",
      status: "failure",
      details: { reason: "No session" },
      ipAddress: getClientIP(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitKey = `tenant_${session.id}`;
  if (!checkRateLimit(rateLimitKey, 30, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    if (!canAccessOrganization(session, session.organizationId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!canPerformAction(session, "view_reports") && !canPerformAction(session, "all_data_access")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const snapshot = await getTenantSnapshot(user.organizationId);

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "data.read",
      resource: "tenant",
      status: "success",
      details: { plan: snapshot.plan },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    console.error("Tenant API error:", error);

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "error",
      resource: "tenant",
      status: "failure",
      details: { error: String(error) },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 });
  }
}
