import { NextRequest, NextResponse } from "next/server";
import { getOrCreateBusinessProfile, recordIntegrationInterest } from "@/lib/business-memory";
import { getSessionFromRequest } from "@/lib/session";
import { canPerformAction } from "@/lib/security";
import { z } from "zod";

const requestSchema = z.object({
  provider: z.literal("whatsapp"),
  businessAccountConfirmed: z.literal(true),
});

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in to manage integrations." }, { status: 401 });
  const profile = await getOrCreateBusinessProfile(session.id, session.organizationId);
  const whatsapp = profile.integrations.find((integration) => integration.type === "whatsapp");
  return NextResponse.json({
    success: true,
    data: {
      whatsapp: {
        connected: whatsapp?.connected === true,
        requestedAt: typeof whatsapp?.metadata?.requestedAt === "string" ? whatsapp.metadata.requestedAt : null,
        capability: "not_configured",
        message: "WhatsApp Business authorization is not configured in this deployment. No conversations are read and no messages are sent.",
      },
    },
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Please sign in before requesting an integration." }, { status: 401 });
  if (!canPerformAction(session, "manage_settings")) {
    return NextResponse.json({ error: "Only a workspace owner or admin can request an integration." }, { status: 403 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm that this is your business's WhatsApp Business account." }, { status: 400 });
  const profile = await recordIntegrationInterest(session.organizationId, session.id, parsed.data.provider);
  const integration = profile.integrations.find((entry) => entry.type === parsed.data.provider);
  return NextResponse.json({
    success: true,
    data: {
      connected: integration?.connected === true,
      requestedAt: integration?.metadata?.requestedAt ?? new Date().toISOString(),
      message: "Your connection request is recorded. WhatsApp is not connected yet, and no messages will be sent.",
    },
  }, { status: 202 });
}
