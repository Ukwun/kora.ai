import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import {
  getOrCreateBusinessProfile,
  updateOnboardingStep,
  recordIntegrationInterest,
} from "@/lib/business-memory";
import { findOrganizationById, findUserByEmail, saveBusinessProfile, updateOrganizationProfile } from "@/lib/store";
import {
  checkRateLimit,
  getClientIP,
  logAudit,
  canAccessOrganization,
  canPerformAction,
  sanitizeInput,
  getSafeErrorMessage,
} from "@/lib/security";

const onboardingSchemas = {
  business_type: z.object({ type: z.enum(["restaurant", "agency", "clinic", "school", "retail", "construction", "manufacturer", "other"]), businessName: z.string().trim().min(2).max(120), industry: z.string().trim().min(2).max(100), country: z.string().trim().min(2).max(80), currency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().trim().min(3).max(80).refine((value) => { try { Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }) }),
  employees: z.object({ employees: z.coerce.number().int().min(0).max(100000), monthlyRevenueRange: z.enum(["unknown", "under_500k", "500k_2m", "2m_10m", "over_10m"]) }),
  customers: z.object({ customers: z.coerce.number().int().min(0).max(10000000) }),
  software: z.object({ software: z.array(z.enum(["whatsapp", "excel", "google_sheets", "quickbooks", "none"])).max(10), offerings: z.string().max(1000).default("") }),
  challenge: z.object({ challenge: z.enum(["finding_customers", "following_up", "payroll", "inventory", "cash_flow", "employees", "marketing"]), goals: z.array(z.string().trim().min(1).max(40)).max(10), communicationChannels: z.array(z.enum(["email", "phone", "whatsapp"])).max(5), preferredPaymentMethods: z.array(z.enum(["bank_transfer", "card", "cash", "mobile_money"])).max(5), workingHours: z.string().trim().max(120), reportingPreferences: z.array(z.enum(["weekly_summary", "monthly_finance", "project_status"])).max(10) }),
  integrations: z.object({ integrations: z.array(z.enum(["gmail", "whatsapp", "bank", "calendar", "stripe", "paystack", "flutterwave", "shopify", "woocommerce", "google_drive", "dropbox"])).max(20) }),
} as const;
const profileEditSchema = z.object({
  businessName: z.string().trim().min(2).max(120).optional(),
  industry: z.string().trim().min(2).max(100).optional(),
  type: z.enum(["restaurant", "agency", "clinic", "school", "retail", "construction", "manufacturer", "other"]).optional(),
  country: z.string().trim().min(2).max(80).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  timezone: z.string().trim().min(3).max(80).refine((value) => { try { Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).optional(),
  employees: z.number().int().min(0).max(100000).optional(),
  customersPerMonth: z.number().int().min(0).max(10000000).optional(),
  monthlyRevenueRange: z.enum(["unknown", "under_500k", "500k_2m", "2m_10m", "over_10m"]).optional(),
  offerings: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  goals: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  existingSoftware: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  communicationChannels: z.array(z.enum(["email", "phone", "whatsapp"])).max(5).optional(),
  preferredPaymentMethods: z.array(z.enum(["bank_transfer", "card", "cash", "mobile_money"])).max(5).optional(),
  workingHours: z.string().trim().max(120).optional(),
  reportingPreferences: z.array(z.enum(["weekly_summary", "monthly_finance", "project_status"])).max(10).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Update at least one profile field." });

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getOrCreateBusinessProfile(session.id, session.organizationId);

    return NextResponse.json({
      success: true,
      profile,
      step: profile.onboardingStep,
      complete: profile.onboardingComplete,
      progress: getOnboardingProgress(profile.onboardingStep),
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

    if (!(step in onboardingSchemas)) return NextResponse.json({ error: "Invalid onboarding step." }, { status: 400 });
    const stepSchema = onboardingSchemas[step as keyof typeof onboardingSchemas];
    const parsedStep = stepSchema.safeParse(data);
    if (!parsedStep.success) return NextResponse.json({ error: "Some answers are missing or invalid. Review this step and try again." }, { status: 400 });

    // Sanitize inputs
    const cleanData: Record<string, unknown> = {};
    Object.entries(parsedStep.data).forEach(([key, value]) => {
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
        await updateOrganizationProfile(session.organizationId, {
          name: String(cleanData.businessName),
          industry: String(cleanData.industry),
          currency: String(cleanData.currency),
          timezone: String(cleanData.timezone),
        });
        profile = await updateOnboardingStep(
          session.id,
          session.organizationId,
          step,
          {
            type: cleanData.type,
            businessName: cleanData.businessName,
            industry: cleanData.industry,
            country: cleanData.country,
            currency: cleanData.currency,
            timezone: cleanData.timezone,
            profileSource: "onboarding",
            profileUpdatedAt: new Date().toISOString(),
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
            monthlyRevenueRange: typeof cleanData.monthlyRevenueRange === "string" ? cleanData.monthlyRevenueRange : undefined,
            profileSource: "onboarding",
            profileUpdatedAt: new Date().toISOString(),
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
            profileSource: "onboarding",
            profileUpdatedAt: new Date().toISOString(),
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
            offerings: typeof cleanData.offerings === "string" ? cleanData.offerings.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20) : [],
            profileSource: "onboarding",
            profileUpdatedAt: new Date().toISOString(),
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
            goals: Array.isArray(cleanData.goals) ? cleanData.goals : [],
            communicationChannels: Array.isArray(cleanData.communicationChannels) ? cleanData.communicationChannels : [],
            preferredPaymentMethods: Array.isArray(cleanData.preferredPaymentMethods) ? cleanData.preferredPaymentMethods : [],
            workingHours: typeof cleanData.workingHours === "string" ? cleanData.workingHours : "",
            reportingPreferences: Array.isArray(cleanData.reportingPreferences) ? cleanData.reportingPreferences : [],
            profileSource: "onboarding",
            profileUpdatedAt: new Date().toISOString(),
            onboardingStep: "integrations",
          }
        );
        nextStep = "integrations";
        message =
          "Perfect. Select the tools you want to connect next. Kora will only mark a tool connected after you approve its provider authorization.";
        break;

      case "integrations":
        // Record integration interest. A provider is only marked connected after its OAuth or API authorization succeeds.
        const integrations = Array.isArray(cleanData.integrations)
          ? cleanData.integrations
          : [cleanData.integrations];

        for (const integration of integrations) {
          if (integration) {
            await recordIntegrationInterest(
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

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id || user.organizationId !== session.organizationId) return NextResponse.json({ error: "Active workspace membership could not be verified." }, { status: 403 });
  if (!canPerformAction(user, "all_data_access")) return NextResponse.json({ error: "Only workspace owners and admins can edit the shared business profile." }, { status: 403 });
  const parsed = profileEditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid business profile information." }, { status: 400 });
  const profile = await getOrCreateBusinessProfile(user.id, user.organizationId);
  Object.assign(profile, parsed.data, { profileSource: "user_updated", profileUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await saveBusinessProfile(profile);
  const organization = await findOrganizationById(user.organizationId);
  if (organization && (parsed.data.businessName || parsed.data.industry || parsed.data.currency || parsed.data.timezone)) {
    await updateOrganizationProfile(user.organizationId, {
      name: parsed.data.businessName ?? organization.name,
      industry: parsed.data.industry ?? organization.industry,
      currency: parsed.data.currency ?? organization.currency,
      timezone: parsed.data.timezone ?? organization.timezone,
    });
  }
  await logAudit({ userId: user.id, organizationId: user.organizationId, action: "data.update", resource: "business_profile", status: "success", details: { fields: Object.keys(parsed.data), source: "user_updated" }, ipAddress: getClientIP(request) });
  return NextResponse.json({ success: true, profile });
}

function getOnboardingProgress(step: string): number {
  const steps: Record<string, number> = {
    business_type: 0,
    employees: 20,
    customers: 40,
    software: 60,
    challenge: 80,
    integrations: 95,
    complete: 100,
  };

  return steps[step] || 0;
}
