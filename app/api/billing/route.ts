import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { readDatabase, writeDatabase } from "@/lib/store";

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
  const body = await request.json().catch(() => null) as { plan?: keyof typeof plans } | null;
  if (!body?.plan || !(body.plan in plans)) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  const database = await readDatabase();
  const currentSeats = database.users.filter((user) => user.organizationId === session.organizationId).length + database.memberships.filter((member) => member.organizationId === session.organizationId && member.status === "invited").length;
  if (currentSeats > plans[body.plan].seatLimit) return NextResponse.json({ error: "The selected plan does not have enough seats." }, { status: 409 });
  const subscription = { organizationId: session.organizationId, plan: body.plan, status: "active" as const, seatLimit: plans[body.plan].seatLimit, updatedAt: new Date().toISOString() };
  const index = database.billingSubscriptions.findIndex((entry) => entry.organizationId === session.organizationId);
  if (index >= 0) database.billingSubscriptions[index] = subscription; else database.billingSubscriptions.push(subscription);
  await writeDatabase(database);
  return NextResponse.json({ success: true, data: { ...subscription, monthlyPrice: plans[body.plan].monthlyPrice } });
}
