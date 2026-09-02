import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findUserByEmail, findOrganizationById } from "@/lib/store";
import { AIEngine, type AIContext, type AIMessage } from "@/lib/ai";

const aiEngine = new AIEngine();

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, messages, context } = body as {
      action: "recommendations" | "insights" | "analyze" | "chat";
      messages?: AIMessage[];
      context?: Partial<AIContext>;
    };

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await findOrganizationById(user.organizationId);
    if (!organization) {
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

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("AI endpoint error:", error);
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
}
