import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail, findOrganizationById } from "@/lib/store";
import { AIEngine, type AIContext, type AIMessage } from "@/lib/ai";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  canPerformAction,
  sanitizeInput,
  getSafeErrorMessage,
} from "@/lib/security";

const aiEngine = new AIEngine();

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    await logAudit({
      userId: "anonymous",
      organizationId: "unknown",
      action: "permission.denied",
      resource: "ai",
      status: "failure",
      details: { reason: "No session" },
      ipAddress: getClientIP(request),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - 100 AI requests per minute per user
  const rateLimitKey = `ai_${session.id}`;
  if (!checkRateLimit(rateLimitKey, 100, 60)) {
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "permission.denied",
      resource: "ai",
      status: "failure",
      details: { reason: "Rate limit exceeded" },
      ipAddress: getClientIP(request),
    });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    // Verify organization access
    if (!canAccessOrganization(session, session.organizationId)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "ai",
        status: "failure",
        details: { reason: "Organization access denied" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Check permission for AI access
    if (!canPerformAction(session, "all_data_access")) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "ai",
        status: "failure",
        details: { reason: "Insufficient permissions" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Insufficient permissions for AI features" },
        { status: 403 }
      );
    }

    const body = await request.json();
    let { action, messages, context } = body as {
      action: "recommendations" | "insights" | "analyze" | "chat";
      messages?: AIMessage[];
      context?: Partial<AIContext>;
    };

    // Sanitize action input
    action = sanitizeInput(String(action), 50) as any;

    const user = await findUserByEmail(session.email);
    if (!user) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "error",
        resource: "ai",
        status: "failure",
        details: { reason: "User not found" },
      });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await findOrganizationById(user.organizationId);
    if (!organization) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "error",
        resource: "ai",
        status: "failure",
        details: { reason: "Organization not found" },
      });
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const fullContext: AIContext = {
      user,
      organization,
      recentActivity: context?.recentActivity || [],
      memoryNodes: context?.memoryNodes || [],
      metrics: context?.metrics || { revenue: 0, customers: 0, tasks: 0, retention: 0 },
    };

    let result;

    switch (action) {
      case "recommendations":
        result = await aiEngine.generateRecommendations(fullContext);
        break;

      case "insights":
        const analytics = await aiEngine.analyzeContext(fullContext);
        result = await aiEngine.generateInsights(analytics);
        break;

      case "analyze":
        result = await aiEngine.analyzeContext(fullContext);
        break;

      case "chat":
        if (!messages || messages.length === 0) {
          return NextResponse.json({ error: "No messages provided" }, { status: 400 });
        }
        const response = await aiEngine.chat(messages, fullContext);
        result = { message: response };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Log successful AI operation
    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "ai.recommendation",
      resource: "ai",
      status: "success",
      details: { action },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("AI endpoint error:", error);

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "error",
      resource: "ai",
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
