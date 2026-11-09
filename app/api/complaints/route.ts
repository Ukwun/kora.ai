import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBusinessMemoryRecord, listBusinessMemoryRecords } from "@/lib/business-memory-records";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { notifyOrganization } from "@/lib/notifications";

const createSchema = z.object({
  category: z.enum(["product", "billing", "service", "privacy", "safety", "other"]),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(3000),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await listBusinessMemoryRecords(session.organizationId, 500);
  const teamAccess = canPerformAction(session, "view_team_data") || canPerformAction(session, "all_data_access");
  return NextResponse.json({
    success: true,
    data: records.filter((record) =>
      record.entityType === "complaint" && (teamAccess || record.createdBy === session.id),
    ),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a subject and describe the issue in at least 10 characters." }, { status: 400 });
  const record = await createBusinessMemoryRecord({
    organizationId: session.organizationId,
    createdBy: session.id,
    entityType: "complaint",
    title: parsed.data.subject,
    summary: parsed.data.description,
    data: { category: parsed.data.category, status: "open", submittedBy: session.id, submittedByName: session.name, submittedByEmail: session.email },
    status: "open",
    source: "user_confirmed",
    verificationStatus: "user_confirmed",
    tags: ["support", "complaint", parsed.data.category],
  });
  await notifyOrganization({
    organizationId: session.organizationId,
    actorUserId: session.id,
    event: "integrationEvent",
    title: "Business support complaint submitted",
    body: `${parsed.data.subject} was submitted for review.`,
    data: { complaintId: record.id, category: parsed.data.category },
  });
  return NextResponse.json({ success: true, data: record, message: "Your complaint was submitted to Kora support." }, { status: 201 });
}
