import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listBusinessMemoryRecords, updateBusinessMemoryRecord } from "@/lib/business-memory-records";
import { getPlatformAdminRequest } from "@/lib/platform-admin";
import { checkDistributedRateLimit } from "@/lib/security";
import { notifyOrganization } from "@/lib/notifications";
import { readDatabase } from "@/lib/store";

const schema = z.object({
  organizationId: z.string().min(1),
  complaintId: z.string().min(1),
  status: z.enum(["under_review", "resolved", "dismissed"]),
  response: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: NextRequest) {
  const access = await getPlatformAdminRequest(request);
  if ("response" in access) return access.response;
  if (!(await checkDistributedRateLimit(`platform_admin_complaint_${access.session.id}`, 30, 60))) {
    return NextResponse.json({ error: "Too many complaint updates. Try again shortly." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid complaint status." }, { status: 400 });
  const database = await readDatabase();
  if (!database.organizations.some((organization) => organization.id === parsed.data.organizationId)) {
    return NextResponse.json({ error: "Business workspace not found." }, { status: 404 });
  }
  const records = await listBusinessMemoryRecords(parsed.data.organizationId, 500);
  const complaint = records.find((record) =>
    record.id === parsed.data.complaintId && record.entityType === "complaint",
  );
  if (!complaint) return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
  const updated = await updateBusinessMemoryRecord(parsed.data.organizationId, complaint.id, access.session.id, {
    status: parsed.data.status,
    data: {
      ...complaint.data,
      status: parsed.data.status,
      adminResponse: parsed.data.response,
      reviewedBy: access.session.email,
      reviewedAt: new Date().toISOString(),
    },
  });
  await notifyOrganization({
    organizationId: parsed.data.organizationId,
    actorUserId: access.session.id,
    userIds: typeof complaint.data.submittedBy === "string" ? [complaint.data.submittedBy] : [complaint.createdBy],
    event: "integrationEvent",
    title: "Your support complaint was updated",
    body: parsed.data.response || `The status is now ${parsed.data.status.replace("_", " ")}.`,
    data: { complaintId: complaint.id, status: parsed.data.status },
  });
  return NextResponse.json({ success: true, data: updated });
}
