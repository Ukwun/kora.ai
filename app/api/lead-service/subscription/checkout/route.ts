import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { listBusinessMemoryRecords, updateBusinessMemoryRecord } from "@/lib/business-memory-records";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) return NextResponse.json({ error: "Only an owner or admin can start checkout." }, { status: 403 });
  if (!process.env.PAYSTACK_SECRET_KEY) return NextResponse.json({ error: "Paystack checkout is not configured for this deployment." }, { status: 503 });
  const body = await request.json().catch(() => null) as { subscriptionId?: string } | null;
  const records = await listBusinessMemoryRecords(session.organizationId, 200);
  const subscription = records.find((record) => record.id === body?.subscriptionId && record.entityType === "lead_subscription" && ["pending_checkout", "checkout_failed"].includes(record.status));
  if (!subscription) return NextResponse.json({ error: "Subscription request was not found or is no longer eligible for checkout." }, { status: 404 });
  const response = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: session.email, amount: Number(subscription.data.monthlyPrice) * 100, currency: subscription.data.currency ?? "NGN", callback_url: `${process.env.APP_URL}/dashboard?lead_checkout=complete`, metadata: { organizationId: session.organizationId, subscriptionId: subscription.id, plan: subscription.data.plan } }) });
  const result = await response.json().catch(() => ({})) as { status?: boolean; data?: { authorization_url?: string; reference?: string }; message?: string };
  if (!response.ok || !result.status || !result.data?.authorization_url) { await updateBusinessMemoryRecord(session.organizationId, subscription.id, session.id, { status: "checkout_failed", data: { ...subscription.data, paymentStatus: "checkout_failed", checkoutError: result.message ?? "Paystack initialization failed" } }); return NextResponse.json({ error: result.message ?? "Checkout could not be initialized." }, { status: 502 }); }
  await updateBusinessMemoryRecord(session.organizationId, subscription.id, session.id, { data: { ...subscription.data, paymentStatus: "checkout_started", checkoutReference: result.data.reference } });
  return NextResponse.json({ success: true, authorizationUrl: result.data.authorization_url, reference: result.data.reference });
}
