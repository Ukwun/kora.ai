import { NextResponse } from "next/server";
import { postgresEnabled, query } from "@/lib/db";
import { isTransactionalEmailConfigured } from "@/lib/email-provider";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export async function GET() {
  let database: "ok" | "unavailable" | "ok-development-file-store" = postgresEnabled ? "unavailable" : "ok-development-file-store";
  if (postgresEnabled) {
    try { await query("SELECT 1 AS ok"); database = "ok"; } catch { database = "unavailable"; }
  }
  const healthy = database !== "unavailable";
  return NextResponse.json({ status: healthy ? "ok" : "degraded", database, providers: { email: isTransactionalEmailConfigured(), whatsapp: isWhatsAppConfigured() }, timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
