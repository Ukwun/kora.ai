import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { findWhatsAppConnectionByPhoneNumberId, createWhatsAppMessage } from "@/lib/whatsapp-storage";
import { listOrganizationRecords } from "@/lib/operations";
import type { Customer } from "@/lib/store";
import { logAudit } from "@/lib/security";

function validSignature(body: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("hub.verify_token") !== process.env.WHATSAPP_VERIFY_TOKEN) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(params.get("hub.challenge") || "", { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  let payload: { entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }> } }> }> };
  try { payload = JSON.parse(rawBody) as typeof payload; } catch { return NextResponse.json({ error: "Invalid webhook JSON" }, { status: 400 }); }
  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) continue;
    const connection = await findWhatsAppConnectionByPhoneNumberId(phoneNumberId);
    if (!connection) continue;
    const customers = await listOrganizationRecords<Customer>("customers", connection.organizationId);
    for (const message of value.messages ?? []) {
      if (!message.id || message.type !== "text" || !message.text?.body || !message.from) continue;
      const normalized = message.from.replace(/\D/g, "");
      const customer = customers.find((candidate) => (candidate.phone || "").replace(/\D/g, "") === normalized);
      const body = message.text.body.trim();
      const consentStatus = /^(stop|unsubscribe|cancel|quit)$/i.test(body) ? "opted_out" : /^(start|subscribe|yes)$/i.test(body) ? "opted_in" : "unknown";
      await createWhatsAppMessage({ organizationId: connection.organizationId, customerId: customer?.id, connectionId: connection.id, direction: "inbound", providerMessageId: message.id, fromPhone: message.from, body, status: "received", consentStatus });
      await logAudit({ userId: customer?.id ?? "system", organizationId: connection.organizationId, action: "data.create", resource: "whatsapp_message", resourceId: message.id, status: "success", details: { direction: "inbound", customerMatched: Boolean(customer), consentStatus } });
    }
  }
  return NextResponse.json({ received: true });
}
