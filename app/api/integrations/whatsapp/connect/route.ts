import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { isWhatsAppOAuthConfigured } from "@/lib/whatsapp";
import { createWhatsAppOAuthState } from "@/lib/whatsapp-oauth";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Sign in before connecting WhatsApp." }, { status: 401 });
  if (!canPerformAction(session, "manage_settings")) return NextResponse.json({ error: "Only an owner or admin can connect WhatsApp." }, { status: 403 });
  if (!isWhatsAppOAuthConfigured()) return NextResponse.json({ error: "WhatsApp OAuth is not configured for this deployment." }, { status: 503 });
  const state = createWhatsAppOAuthState(session.id, session.organizationId);
  const url = new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.WHATSAPP_CLIENT_ID || process.env.WHATSAPP_APP_ID || "");
  url.searchParams.set("redirect_uri", process.env.WHATSAPP_REDIRECT_URI || "");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "business_management,whatsapp_business_management,whatsapp_business_messaging");
  return NextResponse.json({ success: true, url: url.toString() });
}

