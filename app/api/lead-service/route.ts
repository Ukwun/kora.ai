import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBusinessMemoryRecord, listBusinessMemoryRecords } from "@/lib/business-memory-records";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";

const schema = z.object({
  package: z.enum(["pilot", "steady", "scale"]),
  country: z.string().trim().min(2).max(80),
  region: z.string().trim().max(100).optional(),
  jobTitles: z.array(z.string().trim().min(2).max(80)).min(1).max(10),
  industries: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
  companySize: z.enum(["any", "1-10", "11-50", "51-200", "201+"]),
  ageMin: z.coerce.number().int().min(18).max(100).optional(),
  ageMax: z.coerce.number().int().min(18).max(100).optional(),
  interests: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
  acceptsReviewTerms: z.literal(true),
}).refine((value) => !value.ageMin || !value.ageMax || value.ageMin <= value.ageMax, {
  message: "The minimum age must not exceed the maximum age.",
  path: ["ageMax"],
}).refine((value) => {
  const disallowed = /\b(race|ethnicity|religion|religious|political|politics|health|medical|disability|sexual orientation)\b/i;
  return [...value.jobTitles, ...value.industries, ...value.interests].every((item) => !disallowed.test(item));
}, {
  message: "Targeting based on sensitive personal traits is not supported.",
});

const packageDetails = {
  pilot: { label: "Pilot", requestedMonthlyVolume: 25 },
  steady: { label: "Steady growth", requestedMonthlyVolume: 100 },
  scale: { label: "Scale", requestedMonthlyVolume: 250 },
} as const;

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in to view lead-service requests." }, { status: 401 });
  const records = await listBusinessMemoryRecords(session.organizationId, 100);
  const canViewTeam = canPerformAction(session, "view_team_data") || canPerformAction(session, "all_data_access");
  const requests = records.filter((record) => record.entityType === "lead_request" && (canViewTeam || record.createdBy === session.id));
  return NextResponse.json({ success: true, data: requests });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in before requesting a lead-service review." }, { status: 401 });
  if (!canPerformAction(session, "all_data_access")) {
    return NextResponse.json({ error: "Only a workspace owner or admin can request a lead-service review." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the audience details and confirm the service terms before submitting." }, { status: 400 });

  const { package: packageId, acceptsReviewTerms, ...targeting } = parsed.data;
  const selectedPackage = packageDetails[packageId];
  const record = await createBusinessMemoryRecord({
    organizationId: session.organizationId,
    createdBy: session.id,
    entityType: "lead_request",
    title: `${selectedPackage.label} lead-service review`,
    summary: `Review requested for a ${targeting.country}${targeting.region ? `, ${targeting.region}` : ""} audience. This is a request only; no leads, subscription, or payment have been created.`,
    data: {
      package: packageId,
      packageLabel: selectedPackage.label,
      requestedMonthlyVolume: selectedPackage.requestedMonthlyVolume,
      targeting,
      fulfillmentStatus: "availability_review_required",
      paymentStatus: "not_started",
      termsAcceptedAt: acceptsReviewTerms ? new Date().toISOString() : undefined,
    },
    status: "active",
    source: "user_confirmed",
    verificationStatus: "user_confirmed",
    tags: ["lead-service", "review-request"],
  });
  return NextResponse.json({ success: true, data: record }, { status: 201 });
}
