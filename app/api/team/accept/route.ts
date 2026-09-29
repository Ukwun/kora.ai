import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest, setSessionCookie } from "@/lib/session";
import { acceptOrganizationInvite, createUser, findUserByEmail, readDatabase } from "@/lib/store";
import { logAudit } from "@/lib/security";

const schema = z.object({ token: z.string().min(32).max(256), name: z.string().trim().min(2).max(100).optional(), password: z.string().min(8).max(128).optional() });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invitation details are invalid." }, { status: 400 });
  const database = await readDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const invite = database.memberships.find((entry) => entry.token === tokenHash && entry.status === "invited" && entry.expiresAt && Date.parse(entry.expiresAt) > Date.now());
  if (!invite) return NextResponse.json({ error: "This invitation is invalid or expired." }, { status: 410 });
  const session = await getSessionFromRequest(request);
  let user = session ? await findUserByEmail(session.email) : await findUserByEmail(invite.email);
  if (user && user.email.toLowerCase() !== invite.email.toLowerCase()) return NextResponse.json({ error: "Sign in with the email address this invitation was sent to." }, { status: 403 });
  if (user && !session) {
    if (!parsed.data.password || !await bcrypt.compare(parsed.data.password, user.passwordHash)) return NextResponse.json({ error: "Sign in with the account password to accept this invitation.", accountRequired: false, passwordRequired: true }, { status: 401 });
  }
  if (!user) {
    if (!parsed.data.name || !parsed.data.password) return NextResponse.json({ error: "Create an account to accept this invitation.", accountRequired: true }, { status: 400 });
    if (parsed.data.password.length < 10) return NextResponse.json({ error: "Choose a password with at least 10 characters.", accountRequired: true }, { status: 400 });
    user = await createUser({ name: parsed.data.name, email: invite.email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: invite.role, organizationId: invite.organizationId, emailVerified: true });
  }
  const accepted = await acceptOrganizationInvite(parsed.data.token, user);
  if (!accepted) return NextResponse.json({ error: "This invitation was already used or expired." }, { status: 409 });
  await logAudit({ userId: user.id, organizationId: accepted.organizationId, action: "data.update", resource: "membership", resourceId: accepted.id, status: "success", details: { event: "invite.accepted", role: accepted.role }, ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown" });
  return setSessionCookie(NextResponse.json({ success: true, organizationId: accepted.organizationId }), { id: user.id, name: user.name, email: user.email, role: accepted.role, organizationId: accepted.organizationId });
}
