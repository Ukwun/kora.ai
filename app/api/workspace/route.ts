import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { addOrganizationMembership, createOrganization, findOrganizationById, findUserByEmail, getOnboardingForUser, listUserMemberships } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";
import { logAudit } from "@/lib/security";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await findUserByEmail(session.email);
  if (!user) {
    return NextResponse.json({ error: "Session user not found" }, { status: 401 });
  }

  const organization = await findOrganizationById(session.organizationId);
  const memberships = await listUserMemberships(user.id);
  const workspaces = await Promise.all(memberships.map(async (membership) => ({ id: membership.organizationId, role: membership.role, ...(await findOrganizationById(membership.organizationId)) })));
  const onboarding = await getOnboardingForUser(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: session.role,
      organizationId: session.organizationId,
    },
    organization,
    workspaces,
    onboarding,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { organizationId?: string } | null;
  if (!body?.organizationId) return NextResponse.json({ error: "Select a workspace." }, { status: 400 });
  const memberships = await listUserMemberships(session.id);
  const membership = memberships.find((entry) => entry.organizationId === body.organizationId);
  if (!membership) return NextResponse.json({ error: "You are not an active member of that workspace." }, { status: 403 });
  const organization = await findOrganizationById(membership.organizationId);
  if (!organization) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  await logAudit({ userId: session.id, organizationId: membership.organizationId, action: "data.read", resource: "workspace_switch", resourceId: membership.organizationId, status: "success", details: { fromOrganizationId: session.organizationId }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  const response = NextResponse.json({ success: true, organizationId: membership.organizationId });
  return setSessionCookie(response, { id: session.id, name: session.name, email: session.email, role: membership.role, organizationId: membership.organizationId });
}

const createWorkspaceSchema = z.object({ name: z.string().trim().min(2).max(120), industry: z.string().trim().min(2).max(80).default("Other"), currency: z.string().regex(/^[A-Z]{3}$/).default("NGN"), timezone: z.string().min(3).max(80).refine((zone) => { try { Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }).default("Africa/Lagos") });

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await findUserByEmail(session.email);
  if (!user || user.id !== session.id) return NextResponse.json({ error: "Account could not be verified." }, { status: 403 });
  const parsed = createWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid workspace name and locale." }, { status: 400 });
  const organization = await createOrganization(parsed.data);
  const membership = await addOrganizationMembership(user, organization.id, "owner");
  await logAudit({ userId: user.id, organizationId: organization.id, action: "data.create", resource: "organization", resourceId: organization.id, status: "success", details: { source: "workspace_creation" }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  const response = NextResponse.json({ success: true, organizationId: organization.id });
  return setSessionCookie(response, { id: user.id, name: user.name, email: user.email, role: membership.role, organizationId: organization.id });
}
