import { NextRequest, NextResponse } from "next/server";
import { postgresEnabled } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_billing")) return NextResponse.json({ error: "Only the workspace owner can manage backups." }, { status: 403 });
  if (postgresEnabled) return NextResponse.json({ success: true, provider: "managed_postgresql", message: "Backups are managed by the configured PostgreSQL provider. Configure point-in-time recovery and retention there." });
  return NextResponse.json({ success: false, provider: "development-file-store", message: "Development storage is not suitable for production backups." }, { status: 503 });
}

// Get backup status
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_billing")) return NextResponse.json({ error: "Only the workspace owner can view backup status." }, { status: 403 });
  return NextResponse.json({ success: true, provider: postgresEnabled ? "managed_postgresql" : "development-file-store", productionReady: postgresEnabled, message: postgresEnabled ? "Configure retention and point-in-time recovery in your database provider." : "Use managed PostgreSQL before production." });
}
