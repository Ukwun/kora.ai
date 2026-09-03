import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
import { getBusinessProfile } from "@/lib/business-memory";
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
      resource: "analytics",
      status: "failure",
      details: { reason: "No session" },
      ipAddress: getClientIP(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Rate limiting - 60 analytics requests per minute
    const rateLimitKey = `analytics_${session.id}`;
    if (!checkRateLimit(rateLimitKey, 60, 60)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "analytics",
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
        resource: "analytics",
        status: "failure",
        details: { reason: "Organization access denied" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check permission for viewing reports
    if (!canPerformAction(session, "view_reports") && 
        !canPerformAction(session, "view_own_data") &&
        !canPerformAction(session, "all_data_access")) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "analytics",
        status: "failure",
        details: { reason: "Insufficient permissions" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "error",
        resource: "analytics",
        status: "failure",
        details: { reason: "User not found" },
      });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile = await getBusinessProfile(user.id, user.organizationId);
    const metrics = profile?.metrics ?? [];
    const revenueMetrics = metrics.filter((metric) => metric.name.toLowerCase().includes("revenue"));
    const currentRevenue = Number(revenueMetrics.at(-1)?.value) || 0;
    const previousRevenue = Number(revenueMetrics.at(-2)?.value) || 0;
    const revenueGrowth = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : 0;
    const connectedIntegrations = profile?.integrations.filter((integration) => integration.connected).length ?? 0;
    const customerCount = profile?.customersPerMonth ?? 0;

    const analytics = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      organizationId: user.organizationId,
      periods: {
        week: {
          revenue: currentRevenue,
          customers: customerCount,
          tasks: 0,
          invoices: 0,
          payments: 0,
        },
        month: {
          revenue: currentRevenue,
          customers: customerCount,
          tasks: 0,
          invoices: 0,
          payments: 0,
        },
        year: {
          revenue: currentRevenue,
          customers: customerCount,
          tasks: 0,
          invoices: 0,
          payments: 0,
        },
      },
      trends: {
        revenueGrowth,
        customerGrowth: 0,
        taskEfficiency: 0,
        paymentHealth: 0,
      },
      topMetrics: {
        avgInvoiceValue: 0,
        paymentDaysOverdue: 0,
        customerRetention: 0,
        teamProductivity: 0,
      },
      bottlenecks: profile?.mainChallenge ? [`Primary focus: ${profile.mainChallenge.replace(/_/g, " ")}`] : [],
      opportunities: connectedIntegrations === 0 ? ["Connect a business tool to start collecting live activity."] : [],
    };

    // Log successful analytics access
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "data.read",
      resource: "analytics",
      status: "success",
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Analytics error:", error);

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "error",
      resource: "analytics",
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
