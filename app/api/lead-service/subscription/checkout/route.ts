import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Monthly lead-subscription checkout has been retired. Package requests remain review-only until sourcing, fulfilment, and one-time checkout are approved." }, { status: 410 });
}
