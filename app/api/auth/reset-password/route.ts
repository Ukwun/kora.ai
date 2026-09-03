import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, readDatabase, writeDatabase } from "@/lib/store";

const requestSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ token: z.string().min(32), password: z.string().min(8) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "email" in body) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    const user = await findUserByEmail(parsed.data.email);
    if (!user) return NextResponse.json({ success: true, message: "If that account exists, reset instructions have been created." });
    const token = randomBytes(32).toString("hex");
    const database = await readDatabase();
    database.passwordResetTokens.push({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
    await writeDatabase(database);
    return NextResponse.json({ success: true, message: "Reset token created.", resetToken: process.env.NODE_ENV === "production" ? undefined : token });
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
