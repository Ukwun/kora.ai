import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { saveWhatsAppConnection } from "@/lib/whatsapp-storage";
import { verifyWhatsAppOAuthState } from "@/lib/whatsapp-oauth";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  const params = request.nextUrl.searchParams;
  if (!session || !canPerformAction(session, "manage_settings")) return NextResponse.json({ error: "WhatsApp connection requires an authorized workspace administrator." }, { status: 403 });
  const state = params.get("state");
  if (!state || !verifyWhatsAppOAuthState(state, session.id, session.organizationId)) return NextResponse.json({ error: "Invalid or expired WhatsApp connection state." }, { status: 400 });
  if (params.get("error")) return NextResponse.json({ error: "WhatsApp authorization was cancelled." }, { status: 400 });
  const code = params.get("code");
  const phoneNumberId = params.get("phone_number_id");
  const businessAccountId = params.get("waba_id") || params.get("business_account_id") || undefined;
  if (!code || !phoneNumberId) return NextResponse.json({ error: "Meta returned no authorization code or phone number ID. Embedded Signup must provide both." }, { status: 400 });
  const clientId = process.env.WHATSAPP_CLIENT_ID || process.env.WHATSAPP_APP_ID;
  const clientSecret = process.env.WHATSAPP_CLIENT_SECRET || process.env.WHATSAPP_APP_SECRET;
  const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId || ""); tokenUrl.searchParams.set("client_secret", clientSecret || ""); tokenUrl.searchParams.set("redirect_uri", process.env.WHATSAPP_REDIRECT_URI || ""); tokenUrl.searchParams.set("code", code);
  const response = await fetch(tokenUrl);
  const result = await response.json().catch(() => ({})) as { access_token?: string; error?: { message?: string } };
  if (!response.ok || !result.access_token) return NextResponse.json({ error: result.error?.message ?? "Meta token exchange failed." }, { status: 502 });
  await saveWhatsAppConnection({ organizationId: session.organizationId, connectedBy: session.id, businessAccountId, phoneNumberId, accessToken: result.access_token });
  return NextResponse.redirect(new URL("/dashboard?whatsapp=connected", request.url));
}
