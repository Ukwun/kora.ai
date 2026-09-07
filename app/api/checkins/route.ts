import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMemoryNode } from "@/lib/business-memory";
import { getSessionFromRequest } from "@/lib/session";
import { logAudit } from "@/lib/security";

const checkinSchema = z.object({
  type: z.enum(["hired", "customer_cancelled", "product_launched", "payment_received", "prices_changed", "nothing_significant", "other"]),
  note: z.string().trim().max(500).optional(),
});

const labels: Record<z.infer<typeof checkinSchema>["type"], string> = {
  hired: "Team change reported",
  customer_cancelled: "Customer cancellation reported",
  product_launched: "Product launch reported",
  payment_received: "Payment update reported",
  prices_changed: "Price change reported",
  nothing_significant: "Daily operating check-in",
  other: "Business update reported",
};

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = checkinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid update." }, { status: 400 });

  const { type, note } = parsed.data;
  const node = await addMemoryNode(session.organizationId, session.id, {
    category: "observation",
    title: labels[type],
    content: note || (type === "nothing_significant" ? "No significant business change was reported today." : "Owner reported an important business update."),
    confidence: 100,
    source: "manual",
  });
  await logAudit({ userId: session.id, organizationId: session.organizationId, action: "data.create", resource: "daily_checkin", resourceId: node.id, status: "success", details: { type } });
  return NextResponse.json({ success: true, data: node }, { status: 201 });
}
