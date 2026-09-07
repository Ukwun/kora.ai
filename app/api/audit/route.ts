import { NextRequest, NextResponse } from "next/server";
import { postgresEnabled, query } from "@/lib/db";
import { canPerformAction } from "@/lib/security";
import { getSessionFromRequest } from "@/lib/session";

type AuditRow = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: "success" | "failure";
  details: Record<string, unknown>;
  createdAt: string;
};

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "view_audit_logs")) {
    return NextResponse.json({ error: "Only owners and admins can view audit logs." }, { status: 403 });
  }
  if (!postgresEnabled) {
    return NextResponse.json({ error: "Audit history requires the production PostgreSQL database." }, { status: 503 });
  }

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1), 100);
  const result = await query<AuditRow>(
    `SELECT id, action, resource, resource_id AS "resourceId", status, details, created_at AS "createdAt"
     FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [session.organizationId, limit]
  );
  return NextResponse.json({ success: true, data: result.rows });
}
