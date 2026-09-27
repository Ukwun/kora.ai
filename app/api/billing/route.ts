import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase } from "@/lib/store";

const plans = { starter: { seatLimit: 3, monthlyPrice: 14000 }, growth: { seatLimit: 12, monthlyPrice: 34000 }, business: { seatLimit: 25, monthlyPrice: 79000 } } as const;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const database = await readDatabase();
  const subscription = database.billingSubscriptions.find((entry) => entry.organizationId === session.organizationId) ?? { organizationId: session.organizationId, plan: "starter" as const, status: "trial" as const, seatLimit: 3, updatedAt: new Date().toISOString() };
  return NextResponse.json({ success: true, data: { ...subscription, monthlyPrice: plans[subscription.plan].monthlyPrice } });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canPerformAction(session, "manage_billing")) return NextResponse.json({ error: "Only owners can change billing" }, { status: 403 });
  return NextResponse.json({ error: "Plan changes are unavailable until a billing provider checkout is configured. No subscription was changed or charged." }, { status: 503 });
}
