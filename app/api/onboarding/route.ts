import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import {
  getOrCreateBusinessProfile,
  updateOnboardingStep,
  recordIntegrationConnection,
  getBusinessProfile,
} from "@/lib/business-memory";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  sanitizeInput,
  getSafeErrorMessage,
} from "@/lib/security";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getBusinessProfile(session.id, session.organizationId);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile,
      step: profile.onboardingStep,
      complete: profile.onboardingComplete,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      await logAudit({
        userId: "anonymous",
        organizationId: "unknown",
        action: "permission.denied",
        resource: "onboarding",
        status: "failure",
        details: { reason: "No session" },
        ipAddress: getClientIP(request),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessOrganization(session, session.organizationId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Rate limiting
    const rateLimitKey = `onboarding_${session.id}`;
    if (!checkRateLimit(rateLimitKey, 50, 60)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { step, data } = body;

    if (!step || !data) {
      return NextResponse.json(
        { error: "Missing step or data" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const cleanData: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === "string") {
        cleanData[key] = sanitizeInput(value, 500);
      } else {
        cleanData[key] = value;
      }
    });

    // Get current profile
    let profile = await getOrCreateBusinessProfile(
      session.id,
      session.organizationId
    );

    // Process based on step
    let nextStep = step;
    let message = "";

    switch (step) {
      case "business_type":
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            type: cleanData.type,
            onboardingStep: "employees",
          }
        );
        nextStep = "employees";
        message =
          "Great! How many employees do you have? (Just a number is fine)";
        break;

      case "employees":
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            employees: Number(cleanData.employees) || 0,
            onboardingStep: "customers",
          }
        );
        nextStep = "customers";
        message =
          "And roughly how many customers do you serve per month? (Average is fine)";
        break;

      case "customers":
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            customersPerMonth: Number(cleanData.customers) || 0,
            onboardingStep: "software",
          }
        );
        nextStep = "software";
        message =
          "What software are you currently using to run your business? (Select all that apply)";
        break;

      case "software":
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            existingSoftware: Array.isArray(cleanData.software)
              ? cleanData.software
              : [cleanData.software],
            onboardingStep: "challenge",
          }
        );
        nextStep = "challenge";
        message =
          "What's your biggest business challenge right now? (Pick one)";
        break;

      case "challenge":
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            mainChallenge: cleanData.challenge,
            onboardingStep: "integrations",
          }
        );
        nextStep = "integrations";
        message =
          "Perfect! Now let's connect your tools so I can see everything happening in your business. Which would you like to connect?";
        break;

      case "integrations":
        // Record connected integrations
        const integrations = Array.isArray(cleanData.integrations)
          ? cleanData.integrations
          : [cleanData.integrations];

        for (const integration of integrations) {
          if (integration) {
            await recordIntegrationConnection(
              session.organizationId,
              session.id,
              String(integration)
            );
          }
        }

        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            onboardingStep: "complete",
          }
        );
        nextStep = "complete";
        message =
          "Excellent! Your business profile is set up. I'm now learning about your operations. The more data you add, the better I can help. Ready to get started?";
        break;

      case "complete":
        message =
          "Your onboarding is complete! I'm ready to help you run your business.";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid step" },
          { status: 400 }
        );
    }

    await logAudit({
      userId: session.id,
      organizationId: session.organizationId,
      action: "data.create",
      resource: "onboarding",
      status: "success",
      details: { step, nextStep },
      ipAddress: getClientIP(request),
    });

    return NextResponse.json({
      success: true,
      currentStep: step,
      nextStep,
      message,
      profile,
      progress: getOnboardingProgress(nextStep),
    });
  } catch (error) {
    console.error("Onboarding error:", error);

    await logAudit({
      userId: "unknown",
      organizationId: "unknown",
      action: "error",
      resource: "onboarding",
      status: "failure",
      details: { error: String(error) },
    });

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    );
  }
}

function getOnboardingProgress(step: string): number {
  const steps: Record<string, number> = {
    business_type: 16,
    employees: 33,
    customers: 50,
    software: 66,
    challenge: 83,
    integrations: 100,
    complete: 100,
  };

  return steps[step] || 0;
}
