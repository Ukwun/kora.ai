import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPayment } from "@/lib/operations";
import { createBusinessMemoryRecord, listBusinessMemoryRecords, updateBusinessMemoryRecord } from "@/lib/business-memory-records";
import { notifyOrganization } from "@/lib/notifications";

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
  let payload: { data?: { amount?: number; currency?: string; id?: string; customer?: { id?: string }; invoiceId?: string; metadata?: { organizationId?: string; subscriptionId?: string } }; provider?: string };
  try { payload = JSON.parse(rawBody) as typeof payload; } catch { return NextResponse.json({ error: "Invalid webhook JSON" }, { status: 400 }); }
  const data = payload.data;
  if (!data?.amount || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0 || !data.id) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
  const organizationId = data.metadata?.organizationId;
  if (!organizationId) return NextResponse.json({ error: "Missing organization mapping" }, { status: 400 });
  const existing = await listBusinessMemoryRecords(organizationId, 500);
  if (existing.some((record) => record.entityType === "webhook_event" && record.data.providerReference === data.id)) return NextResponse.json({ received: true, duplicate: true });
  await createPayment({ organizationId, amount: data.amount, currency: data.currency ?? "NGN", provider: payload.provider ?? "payment_provider", providerReference: data.id, invoiceId: data.invoiceId, customerId: data.customer?.id, status: "received", receivedAt: new Date().toISOString() });
  await createBusinessMemoryRecord({ organizationId, createdBy: "system", entityType: "webhook_event", title: `Payment webhook ${data.id}`, summary: "A payment provider webhook was processed.", data: { providerReference: data.id, provider: payload.provider ?? "payment_provider" }, status: "processed", source: "integration", verificationStatus: "verified", tags: ["webhook", "payment"] });
  if (data.metadata?.subscriptionId) {
    const subscription = (await listBusinessMemoryRecords(organizationId, 200)).find((record) => record.id === data.metadata?.subscriptionId && record.entityType === "lead_subscription");
    if (subscription) await updateBusinessMemoryRecord(organizationId, subscription.id, "system", { status: "active", data: { ...subscription.data, status: "active", paymentStatus: "paid", paymentReference: data.id } });
  }
  await notifyOrganization({ organizationId, event: "integrationEvent", title: "Payment received", body: `A payment of ${data.currency ?? "NGN"} ${data.amount} was received.`, data: { providerReference: data.id } });
  return NextResponse.json({ received: true });
}
