import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRequestRateLimit } from "@/lib/security";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";
import { findUserByEmail, readDatabase, writeDatabase } from "@/lib/store";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  if (!(await checkRequestRateLimit(request, "auth:resend-verification", 3, 15 * 60))) {
    return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!isTransactionalEmailConfigured() || !process.env.APP_URL) {
    return NextResponse.json({ error: "Account verification email is not configured for this deployment." }, { status: 503 });
  }

  const user = await findUserByEmail(parsed.data.email.toLowerCase());
  if (user && !user.emailVerified && user.accountStatus === "active") {
    const token = randomBytes(32).toString("hex");
    const database = await readDatabase();
    database.emailVerificationTokens = database.emailVerificationTokens.filter((entry) => entry.userId !== user.id || entry.usedAt);
    database.emailVerificationTokens.push({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await writeDatabase(database);

    const verificationUrl = new URL(`/auth/verify?token=${encodeURIComponent(token)}`, process.env.APP_URL).toString();
    try {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your Kora account",
        text: `Verify your email address within 24 hours: ${verificationUrl}`,
        html: `<p>Verify your Kora account within 24 hours.</p><p><a href="${verificationUrl}">Verify email address</a></p>`,
      });
    } catch (error) {
      console.error("Verification email resend failed.", error);
      return NextResponse.json({ error: "The verification email could not be delivered. Try again later." }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true, message: "If the account needs verification, a new link has been sent." });
}
