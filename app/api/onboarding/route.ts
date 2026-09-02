import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { createOrganization, findUserByEmail, saveOnboarding, updateUserOrganization } from "@/lib/store";

const onboardingSchema = z.object({
  businessName: z.string().trim().min(2),
  industry: z.string().trim().min(2),
  goals: z.array(z.string().trim().min(1)).default([]),
  tools: z.array(z.string().trim().min(1)).default([]),
  challenges: z.array(z.string().trim().min(1)).default([]),
});

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Onboarding data is invalid", details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await findUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await createOrganization({
      name: parsed.data.businessName,
      industry: parsed.data.industry,
      timezone: "Africa/Lagos",
      currency: "NGN",
    });

    await updateUserOrganization(user.id, organization.id);

    const onboarding = await saveOnboarding({
      userId: user.id,
      businessName: parsed.data.businessName,
      industry: parsed.data.industry,
      goals: parsed.data.goals,
      tools: parsed.data.tools,
      challenges: parsed.data.challenges,
    });

    return NextResponse.json({
      message: "Workspace configured successfully.",
      organization,
      onboarding,
    });
  } catch {
    return NextResponse.json({ error: "Unable to configure workspace." }, { status: 500 });
  }
}
