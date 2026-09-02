import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";
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

    // Generate sample analytics
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
          revenue: Math.floor(Math.random() * 5000000) + 1000000,
          customers: Math.floor(Math.random() * 50) + 10,
          tasks: Math.floor(Math.random() * 100) + 20,
          invoices: Math.floor(Math.random() * 30) + 5,
          payments: Math.floor(Math.random() * 20) + 3,
        },
        month: {
          revenue: Math.floor(Math.random() * 20000000) + 5000000,
          customers: Math.floor(Math.random() * 200) + 50,
          tasks: Math.floor(Math.random() * 400) + 100,
          invoices: Math.floor(Math.random() * 120) + 30,
          payments: Math.floor(Math.random() * 80) + 20,
        },
        year: {
          revenue: Math.floor(Math.random() * 100000000) + 20000000,
          customers: Math.floor(Math.random() * 1000) + 200,
          tasks: Math.floor(Math.random() * 2000) + 500,
          invoices: Math.floor(Math.random() * 600) + 150,
          payments: Math.floor(Math.random() * 400) + 100,
        },
      },
      trends: {
        revenueGrowth: Math.floor(Math.random() * 40) + 10,
        customerGrowth: Math.floor(Math.random() * 30) + 5,
        taskEfficiency: Math.floor(Math.random() * 40) + 60,
        paymentHealth: Math.floor(Math.random() * 30) + 70,
      },
      topMetrics: {
        avgInvoiceValue: Math.floor(Math.random() * 500000) + 100000,
        paymentDaysOverdue: Math.floor(Math.random() * 20) + 2,
        customerRetention: Math.floor(Math.random() * 30) + 70,
        teamProductivity: Math.floor(Math.random() * 30) + 70,
      },
      bottlenecks: [
        "Quote-to-invoice time averaging 5 days",
        "Payment collection delays from 2 key accounts",
        "Task approval bottleneck in finance team",
      ],
      opportunities: [
        "Upsell premium services to top 20 customers",
        "Automate recurring invoice generation",
        "Implement automated payment reminders",
      ],
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
