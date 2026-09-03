import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase, writeDatabase } from "@/lib/store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_settings")) return NextResponse.json({ error: "Only owners and admins can manage roles" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { role?: string } | null;
  if (!body?.role || !["admin", "manager", "employee"].includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const database = await readDatabase();
  const user = database.users.find((entry) => entry.id === id && entry.organizationId === session.organizationId);
  if (!user || user.role === "owner") return NextResponse.json({ error: "Member not found or cannot be changed" }, { status: 404 });
  user.role = body.role as typeof user.role;
  const membership = database.memberships.find((entry) => entry.userId === user.id && entry.organizationId === session.organizationId);
  if (membership) membership.role = user.role;
  await writeDatabase(database);
  return NextResponse.json({ success: true, data: { id: user.id, role: user.role } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "delete_user")) return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  const { id } = await context.params;
  const database = await readDatabase();
  const user = database.users.find((entry) => entry.id === id && entry.organizationId === session.organizationId);
  if (!user || user.id === session.id || user.role === "owner") return NextResponse.json({ error: "Member not found or cannot be removed" }, { status: 404 });
  user.organizationId = "revoked";
  const membership = database.memberships.find((entry) => entry.userId === id && entry.organizationId === session.organizationId);
  if (membership) membership.status = "revoked";
  await writeDatabase(database);
  return NextResponse.json({ success: true });
}
