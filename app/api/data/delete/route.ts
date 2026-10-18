import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction, logAudit } from "@/lib/security";
import { deleteOrganization } from "@/lib/store";

const schema = z.object({ confirmation: z.string().min(1) });

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_billing")) return NextResponse.json({ error: "Only the workspace owner can delete workspace data." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmation !== `DELETE ${session.organizationId}`) return NextResponse.json({ error: `Type DELETE ${session.organizationId} to permanently remove this workspace.` }, { status: 400 });
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.delete", resource: "organization", resourceId: session.organizationId, status: "success", details: { confirmed: true } });
  const deleted = await deleteOrganization(session.organizationId);
  if (!deleted) return NextResponse.json({ error: "Workspace was already deleted." }, { status: 404 });
  return NextResponse.json({ success: true, deleted: true });
}
