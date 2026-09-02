import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { recordFeedback, getFeedbackStats, shouldShowRecommendation } from "@/lib/ai-feedback";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  sanitizeInput,
} from "@/lib/security";
import type { RecommendationFeedback } from "@/lib/ai-feedback";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      await logAudit({
        userId: "anonymous",
        organizationId: "unknown",
        action: "permission.denied",
        resource: "ai_feedback",
        status: "failure",
        details: { reason: "No session" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitKey = `feedback_${session.id}`;
    if (!checkRateLimit(rateLimitKey, 50, 60)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "ai_feedback",
        status: "failure",
        details: { reason: "Rate limit exceeded" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    // Verify org access
    if (!canAccessOrganization(session, session.organizationId)) {
      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "permission.denied",
        resource: "ai_feedback",
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
    const { action, recommendationId, feedbackType, comment } = body;

    if (action === "submit") {
      if (!recommendationId || !feedbackType) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      const feedback: Omit<RecommendationFeedback, "id" | "createdAt"> = {
        recommendationId,
        userId: session.id,
        organizationId: session.organizationId,
        feedbackType,
        comment: comment ? sanitizeInput(comment, 500) : undefined,
      };

      const result = await recordFeedback(feedback);

      await logAudit({
        userId: session.id,
        organizationId: session.organizationId,
        action: "ai.feedback",
        resource: "recommendation",
        resourceId: recommendationId,
        status: "success",
        details: { feedbackType },
        ipAddress: getClientIP(request),
      });

      return NextResponse.json({
        success: true,
        feedback: result,
        message: "Thank you for your feedback. It helps us improve recommendations.",
      });
    }

    if (action === "stats") {
      const stats = getFeedbackStats(session.organizationId, session.id);

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("AI feedback error:", error);

    await logAudit({
      userId: "unknown",
      organizationId: "unknown",
      action: "error",
      resource: "ai_feedback",
      status: "failure",
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: "Failed to process feedback" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve feedback stats
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = getFeedbackStats(session.organizationId, session.id);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get feedback error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve feedback" },
      { status: 500 }
    );
  }
}
