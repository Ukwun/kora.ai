import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { findOrganizationById, findUserByEmail, getOnboardingForUser } from "@/lib/store";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByEmail(session.email);
  if (!user) {
    return NextResponse.json({ error: "Session user not found" }, { status: 401 });
  }

  const organization = await findOrganizationById(user.organizationId);
  const onboarding = await getOnboardingForUser(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    organization,
    onboarding,
  });
}
