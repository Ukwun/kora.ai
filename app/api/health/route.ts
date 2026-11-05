import { NextResponse } from "next/server";
import { postgresEnabled, query } from "@/lib/db";
import { isTransactionalEmailConfigured } from "@/lib/email-provider";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { getProductionConfigurationIssues } from "@/lib/production-config";
import { isProductionRuntime } from "@/lib/database-config";
import { checkRateLimitBackend } from "@/lib/rate-limit";

export async function GET() {
  const productionIssues = getProductionConfigurationIssues();
  const rateLimitAvailable = isProductionRuntime()
    ? await checkRateLimitBackend()
    : Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  let database: "ok" | "unavailable" | "ok-development-file-store" = postgresEnabled
    ? "unavailable"
    : isProductionRuntime()
      ? "unavailable"
      : "ok-development-file-store";
  if (postgresEnabled) {
    try { await query("SELECT 1 AS ok"); database = "ok"; } catch { database = "unavailable"; }
  }
  const healthy = database !== "unavailable"
    && productionIssues.length === 0
    && (!isProductionRuntime() || rateLimitAvailable);
  const emailConfigured = isTransactionalEmailConfigured();
  const providers = {
    email: { configured: emailConfigured },
    ai: { configured: Boolean(process.env.OPENAI_API_KEY) },
    google: { configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
    facebook: { configured: Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) },
    payments: { configured: Boolean(process.env.PAYSTACK_PUBLIC_KEY && process.env.PAYSTACK_SECRET_KEY && process.env.PAYMENT_WEBHOOK_SECRET) },
    whatsapp: { configured: isWhatsAppConfigured() },
    rateLimit: { configured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), available: rateLimitAvailable },
  };
  return NextResponse.json({
    status: healthy ? "ok" : "degraded",
    database,
    providers,
    configuration: { complete: productionIssues.length === 0, missing: productionIssues },
    timestamp: new Date().toISOString(),
  }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
