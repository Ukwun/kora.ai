import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBusinessMemoryRecord } from "@/lib/business-memory-records";
import { getPlatformAdminRequest } from "@/lib/platform-admin";
import { checkDistributedRateLimit } from "@/lib/security";
import { notifyOrganization } from "@/lib/notifications";
import { readDatabase } from "@/lib/store";

const schema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(2).max(1000),
});

export async function POST(request: NextRequest) {
  const access = await getPlatformAdminRequest(request);
  if ("response" in access) return access.response;
  if (!(await checkDistributedRateLimit(`platform_admin_suggestion_${access.session.id}`, 30, 60))) {
    return NextResponse.json({ error: "Too many suggestions. Try again shortly." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a business and provide a useful suggestion." }, { status: 400 });
  const organization = (await readDatabase()).organizations.find((item) => item.id === parsed.data.organizationId);
  if (!organization) return NextResponse.json({ error: "Business workspace not found." }, { status: 404 });

  const record = await createBusinessMemoryRecord({
    organizationId: organization.id,
    createdBy: access.session.id,
    entityType: "ai_recommendation",
    title: parsed.data.title,
    summary: parsed.data.summary,
    data: {
      recommendationType: "platform_admin_suggestion",
      suggestedBy: access.session.email,
      suggestedByName: access.session.name,
      reviewRequired: true,
      source: "platform_admin",
    },
    status: "pending_approval",
    source: "user_confirmed",
    verificationStatus: "user_confirmed",
    tags: ["platform-admin", "suggestion", "advisory"],
  });
  await notifyOrganization({
    organizationId: organization.id,
    actorUserId: access.session.id,
    event: "aiRecommendation",
    title: "A platform admin shared a suggestion",
    body: parsed.data.title,
    data: { recommendationId: record.id, source: "platform_admin" },
  });
  return NextResponse.json({ success: true, data: record, message: "The advisory suggestion was saved and the business was notified." }, { status: 201 });
}
