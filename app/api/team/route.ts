import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase, writeDatabase } from "@/lib/store";

const schema = z.object({ email: z.string().email(), role: z.enum(["admin", "manager", "employee"]).default("employee") });

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = await readDatabase();
  const members = database.users.filter((user) => user.organizationId === session.organizationId).map(({ passwordHash, ...user }) => user);
  const invites = database.memberships.filter((member) => member.organizationId === session.organizationId && member.status === "invited").map(({ token, ...invite }) => invite);
  return NextResponse.json({ success: true, data: { members, invites } });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "create_user")) return NextResponse.json({ error: "Only owners and admins can invite team members" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  const database = await readDatabase();
  const activeSeats = database.users.filter((user) => user.organizationId === session.organizationId).length + database.memberships.filter((member) => member.organizationId === session.organizationId && member.status === "invited").length;
  const subscription = database.billingSubscriptions.find((entry) => entry.organizationId === session.organizationId);
  const seatLimit = subscription?.seatLimit ?? 12;
  if (activeSeats >= seatLimit) return NextResponse.json({ error: "Your plan has no available seats." }, { status: 409 });
  if (database.users.some((user) => user.email === parsed.data.email.toLowerCase()) || database.memberships.some((member) => member.organizationId === session.organizationId && member.email === parsed.data.email.toLowerCase() && member.status === "invited")) return NextResponse.json({ error: "This user is already a member or invited." }, { status: 409 });
  const token = randomBytes(32).toString("hex");
  const invite = { id: `invite_${randomUUID()}`, organizationId: session.organizationId, email: parsed.data.email.toLowerCase(), role: parsed.data.role, status: "invited" as const, token, createdAt: new Date().toISOString() };
  database.memberships.push(invite);
  await writeDatabase(database);
  return NextResponse.json({ success: true, data: { ...invite, inviteUrl: `${process.env.API_BASE_URL ?? "http://localhost:3000"}/invite/${token}` } }, { status: 201 });
}
