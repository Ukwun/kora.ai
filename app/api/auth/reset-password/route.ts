import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, readDatabase, writeDatabase } from "@/lib/store";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";

const requestSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(32), password: z.string().min(8) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "email" in body) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    if (process.env.NODE_ENV === "production" && (!isTransactionalEmailConfigured() || !process.env.APP_URL)) {
      return NextResponse.json({ error: "Password recovery email is not configured for this deployment." }, { status: 503 });
    }
    const user = await findUserByEmail(parsed.data.email);
    if (!user) return NextResponse.json({ success: true, message: "If that account exists, reset instructions have been created." });
    const token = randomBytes(32).toString("hex");
    const database = await readDatabase();
    database.passwordResetTokens.push({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    await writeDatabase(database);
    if (isTransactionalEmailConfigured()) {
      const appUrl = process.env.APP_URL || (process.env.NODE_ENV === "development" ? new URL(request.url).origin : "");
      if (!appUrl) return NextResponse.json({ error: "APP_URL must be configured to send account recovery links." }, { status: 503 });
      const resetUrl = new URL(`/auth/reset?token=${encodeURIComponent(token)}`, appUrl).toString();
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your Kora password",
        text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
        html: `<p>Use the link below to reset your Kora password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`,
      });
    }
    return NextResponse.json({ success: true, message: "If that account exists, reset instructions have been sent.", ...(process.env.NODE_ENV !== "production" && !isTransactionalEmailConfigured() ? { developmentResetToken: token } : {}) });
  }
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  const database = await readDatabase();
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const token = database.passwordResetTokens.find((entry) => entry.tokenHash === tokenHash && !entry.usedAt && new Date(entry.expiresAt) > new Date());
  if (!token) return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
  const user = database.users.find((entry) => entry.id === token.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  user.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  token.usedAt = new Date().toISOString();
  await writeDatabase(database);
  return NextResponse.json({ success: true, message: "Password updated successfully." });
}
