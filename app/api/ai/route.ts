import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail, findOrganizationById } from "@/lib/store";
import { AIEngine, type AIMessage } from "@/lib/ai";
import { answerBusinessQuestion } from "@/lib/ai-intelligence";
import { buildAuthorizedAIContext } from "@/lib/ai-context";
import { isFirebaseAdminConfigured } from "@/lib/firebase-admin";
import { createBusinessMemoryRecord } from "@/lib/business-memory-records";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
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
    const body = await request.json();
    const { action: requestedAction, messages } = body as {
      action: "recommendations" | "insights" | "analyze" | "chat";
      messages?: AIMessage[];
    };

    // Sanitize action input
    const action = sanitizeInput(String(requestedAction), 50);

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

    if (user.id !== session.id || user.organizationId !== session.organizationId) {
      await logAudit({ userId: session.id, organizationId: session.organizationId, action: "permission.denied", resource: "ai", status: "failure", details: { reason: "The current account or workspace no longer matches this session." }, ipAddress: getClientIP(request) });
      return NextResponse.json({ error: "Your active workspace membership could not be verified." }, { status: 403 });
    }
    if (!canPerformAction(user, "all_data_access")) {
      await logAudit({ userId: user.id, organizationId: user.organizationId, action: "permission.denied", resource: "ai", status: "failure", details: { reason: "Insufficient permissions" }, ipAddress: getClientIP(request) });
      return NextResponse.json({ error: "Insufficient permissions for AI features" }, { status: 403 });
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

    const fullContext = await buildAuthorizedAIContext(user, organization);

    let result;

    switch (action) {
      case "recommendations":
        {
          const recommendations = await aiEngine.generateRecommendations(fullContext);
          if (!isFirebaseAdminConfigured()) {
            result = recommendations.map((recommendation) => ({ ...recommendation, requiresApproval: true, persistence: "not_configured" }));
            break;
          }
          result = await Promise.all(recommendations.map(async (recommendation) => {
            const record = await createBusinessMemoryRecord({
              organizationId: user.organizationId,
              createdBy: user.id,
              entityType: "ai_recommendation",
              title: recommendation.title,
              summary: recommendation.summary,
              data: { action: recommendation.action, category: recommendation.category, intensity: recommendation.intensity, evidence: fullContext.evidence },
              status: "pending_approval",
              source: "system_calculation",
              verificationStatus: "unverified",
              tags: ["ai_recommendation", recommendation.category],
            });
            return { ...recommendation, id: record.id, requiresApproval: true, persistence: "stored" };
          }));
        }
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
        const question = messages.filter((message) => message.role === "user").at(-1)?.content?.trim();
        if (!question || question.length > 2_000) {
          return NextResponse.json({ error: "Enter a business question of up to 2,000 characters." }, { status: 400 });
        }
        const intelligence = await answerBusinessQuestion(user.organizationId, question);
        if (intelligence.intent === "unsupported") {
          result = intelligence;
          break;
        }
        const evidence = JSON.stringify({
          generatedAt: intelligence.generatedAt,
          candidates: intelligence.candidates,
          memoryRecords: intelligence.memoryRecords?.map(({ record, matchedTerms }) => ({
            record: { id: record.id, entityType: record.entityType, title: record.title, summary: record.summary, data: record.data, source: record.source, verificationStatus: record.verificationStatus, updatedAt: record.updatedAt },
            matchedTerms,
          })),
          sources: intelligence.sources,
          dataNotice: intelligence.dataNotice,
        });
        const groundedContext = {
          ...fullContext,
          recentActivity: [],
          memoryNodes: [],
          metrics: { revenue: 0, customers: 0, tasks: 0, retention: null },
        };
        const response = await aiEngine.chat([
          {
            role: "user",
            content: `Question: ${question}\n\nConfirmed Kora analytics evidence (use only these facts; do not invent customers, values, or causes):\n${evidence}`,
          },
        ], groundedContext);
        result = { ...intelligence, message: response };
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
