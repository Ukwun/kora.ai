import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase, writeDatabase } from "@/lib/store";
import { logAudit } from "@/lib/security";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_settings")) return NextResponse.json({ error: "Only owners and admins can manage roles" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { role?: string } | null;
  if (!body?.role || !["admin", "manager", "employee"].includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const database = await readDatabase();
  const membership = database.memberships.find((entry) => entry.userId === id && entry.organizationId === session.organizationId && entry.status === "active");
  if (!membership || membership.role === "owner") return NextResponse.json({ error: "Member not found or cannot be changed" }, { status: 404 });
  membership.role = body.role as typeof membership.role;
  const user = database.users.find((entry) => entry.id === id);
  if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  await writeDatabase(database);
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.update", resource: "membership", resourceId: membership.id, status: "success", details: { memberId: id, role: membership.role }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  return NextResponse.json({ success: true, data: { id: user.id, role: membership.role } });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "delete_user")) return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  const { id } = await context.params;
  const database = await readDatabase();
  const membership = database.memberships.find((entry) => entry.userId === id && entry.organizationId === session.organizationId);
  if (!membership || id === session.id || membership.role === "owner" || membership.status !== "active") return NextResponse.json({ error: "Member not found or cannot be removed" }, { status: 404 });
  membership.status = "revoked";
  await writeDatabase(database);
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.delete", resource: "membership", resourceId: membership.id, status: "success", details: { memberId: id }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  return NextResponse.json({ success: true });
}
