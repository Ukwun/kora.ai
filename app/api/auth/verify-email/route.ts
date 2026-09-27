import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readDatabase, writeDatabase } from "@/lib/store";
import { logAudit } from "@/lib/security";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  const database = await readDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const token = database.emailVerificationTokens.find((entry) => entry.tokenHash === tokenHash && !entry.usedAt && new Date(entry.expiresAt) > new Date());
  if (!token) return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
  const user = database.users.find((entry) => entry.id === token.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  token.usedAt = new Date().toISOString();
  user.emailVerified = true;
  await writeDatabase(database);
  await logAudit({ userId: user.id, organizationId: user.organizationId, action: "data.update", resource: "email_verification", status: "success", details: { method: "one_time_token" } });
  return NextResponse.json({ success: true, message: "Email verified. You can now sign in." });
}
