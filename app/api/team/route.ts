import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase, writeDatabase } from "@/lib/store";
import { sendTransactionalEmail, isTransactionalEmailConfigured } from "@/lib/email-provider";
import { findOrganizationById } from "@/lib/store";
import { logAudit } from "@/lib/security";

const schema = z.object({ email: z.string().email(), role: z.enum(["admin", "manager", "employee"]).default("employee") });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = await readDatabase();
  const members = database.memberships.filter((member) => member.organizationId === session.organizationId && member.status === "active").map((member) => { const user = database.users.find((entry) => entry.id === member.userId); return user && user.accountStatus !== "suspended" ? { id: user.id, name: user.name, email: user.email, role: member.role, organizationId: member.organizationId, createdAt: user.createdAt } : null; }).filter(Boolean);
  const invites = database.memberships.filter((member) => member.organizationId === session.organizationId && member.status === "invited" && (!member.expiresAt || Date.parse(member.expiresAt) > Date.now())).map((member) => Object.fromEntries(Object.entries(member).filter(([key]) => key !== "token")));
  return NextResponse.json({ success: true, data: { members, invites } });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "create_user")) return NextResponse.json({ error: "Only owners and admins can invite team members" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  const database = await readDatabase();
  const activeSeats = database.memberships.filter((member) => member.organizationId === session.organizationId && (member.status === "active" || member.status === "invited")).length;
  const subscription = database.billingSubscriptions.find((entry) => entry.organizationId === session.organizationId);
  const seatLimit = subscription?.seatLimit ?? 12;
  if (activeSeats >= seatLimit) return NextResponse.json({ error: "Your plan has no available seats." }, { status: 409 });
  const email = parsed.data.email.toLowerCase();
  const existingUser = database.users.find((user) => user.email.toLowerCase() === email);
  if (database.memberships.some((member) => member.organizationId === session.organizationId && member.email.toLowerCase() === email && member.status === "active")) return NextResponse.json({ error: "This person is already a workspace member." }, { status: 409 });
  if (database.memberships.some((member) => member.organizationId === session.organizationId && member.email.toLowerCase() === email && member.status === "invited" && (!member.expiresAt || Date.parse(member.expiresAt) > Date.now()))) return NextResponse.json({ error: "This person already has a pending invitation." }, { status: 409 });
  if (process.env.NODE_ENV === "production" && !isTransactionalEmailConfigured()) return NextResponse.json({ error: "Invitation email is not configured." }, { status: 503 });
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  const invite: import("@/lib/store").Membership = { id: `invite_${randomUUID()}`, organizationId: session.organizationId, userId: existingUser?.id, email, role: parsed.data.role, status: "invited", token: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt };
  database.memberships.push(invite);
  await writeDatabase(database);
  const organization = await findOrganizationById(session.organizationId);
  const inviteUrl = new URL(`/invite/${token}`, process.env.APP_URL || new URL(request.url).origin).toString();
  if (isTransactionalEmailConfigured()) {
    try { await sendTransactionalEmail({ to: email, subject: `Join ${organization?.name ?? "a Kora workspace"}`, text: `You have been invited to ${organization?.name ?? "a Kora workspace"} as ${parsed.data.role}. Accept within seven days: ${inviteUrl}`, html: `<p>You have been invited to <strong>${organization?.name ?? "a Kora workspace"}</strong> as ${parsed.data.role}.</p><p><a href="${inviteUrl}">Accept invitation</a> (expires in seven days).</p>` }); }
    catch { invite.status = "revoked"; invite.token = undefined; await writeDatabase(database); return NextResponse.json({ error: "Invitation email could not be delivered. No active invitation was kept." }, { status: 502 }); }
  }
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.create", resource: "membership_invite", resourceId: invite.id, status: "success", details: { email, role: invite.role, expiresAt: invite.expiresAt }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  return NextResponse.json({ success: true, data: { id: invite.id, organizationId: invite.organizationId, email: invite.email, role: invite.role, status: invite.status, expiresAt: invite.expiresAt, ...(process.env.NODE_ENV !== "production" && !isTransactionalEmailConfigured() ? { inviteUrl } : {}) } }, { status: 201 });
}
