import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/operations";

function validSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const actual = Buffer.from(expected, "utf8");
  return received.length === actual.length && timingSafeEqual(received, actual);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? request.headers.get("verif-hash");
  if (!validSignature(rawBody, signature)) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  const payload = JSON.parse(rawBody) as { data?: { amount?: number; currency?: string; id?: string; customer?: { id?: string }; invoiceId?: string }; provider?: string };
  const data = payload.data;
  if (!data?.amount || !data.id) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  const organizationId = request.headers.get("x-kora-organization-id");
  if (!organizationId) return NextResponse.json({ error: "Missing organization mapping" }, { status: 400 });
  await createPayment({ organizationId, amount: data.amount, currency: data.currency ?? "NGN", provider: payload.provider ?? "payment_provider", providerReference: data.id, invoiceId: data.invoiceId, customerId: data.customer?.id, status: "received", receivedAt: new Date().toISOString() });
  return NextResponse.json({ received: true });
}
