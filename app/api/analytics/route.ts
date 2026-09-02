import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await findUserByEmail(session.email);
    if (!user) {
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

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
