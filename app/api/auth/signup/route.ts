import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createOrganization, createUser, findUserByEmail, readDatabase, writeDatabase } from "@/lib/store";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";

const signupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, confirmPassword } = parsed.data;

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production" && (!isTransactionalEmailConfigured() || !process.env.APP_URL)) {
      return NextResponse.json({ error: "Account verification email is not configured for this deployment." }, { status: 503 });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json({ error: "Account already exists." }, { status: 409 });
    }

    const organization = await createOrganization({
      name: `${name.trim()}'s workspace`,
      industry: "Other",
      timezone: "Africa/Lagos",
      currency: "NGN",
    });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email: normalizedEmail,
      passwordHash,
      role: "owner",
      organizationId: organization.id,
      emailVerified: false,
    });
    const verificationToken = randomBytes(32).toString("hex");
    const database = await readDatabase();
    database.emailVerificationTokens.push({ tokenHash: createHash("sha256").update(verificationToken).digest("hex"), userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
    await writeDatabase(database);
    if (isTransactionalEmailConfigured()) {
      const appUrl = process.env.APP_URL || new URL(request.url).origin;
      const verificationUrl = new URL(`/auth/verify?token=${encodeURIComponent(verificationToken)}`, appUrl).toString();
      await sendTransactionalEmail({ to: user.email, subject: "Verify your Kora account", text: `Verify your email address within 24 hours: ${verificationUrl}`, html: `<p>Verify your Kora account within 24 hours.</p><p><a href="${verificationUrl}">Verify email address</a></p>` });
    }
    return NextResponse.json({ success: true, needsVerification: true, message: "Account created. Verify your email before signing in.", ...(process.env.NODE_ENV !== "production" && !isTransactionalEmailConfigured() ? { developmentVerificationUrl: `/auth/verify?token=${encodeURIComponent(verificationToken)}` } : {}) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
