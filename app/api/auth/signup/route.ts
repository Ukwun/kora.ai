import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createOrganization, createUser, findUserByEmail, readDatabase, writeDatabase } from "@/lib/store";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/email-provider";
import { setSessionCookie } from "@/lib/session";
import { checkRequestRateLimit } from "@/lib/security";
import { isProductionRuntime } from "@/lib/database-config";

const signupSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    if (!(await checkRequestRateLimit(request, "auth:signup", 5, 60 * 60))) {
      return NextResponse.json({ error: "Too many sign-up attempts. Try again later." }, { status: 429 });
    }
    const body = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed.", details: parsed.error.flatten() }, { status: 400 });
    }

    const { name, email, password, confirmPassword } = parsed.data;

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    if (isProductionRuntime() && (!isTransactionalEmailConfigured() || !process.env.APP_URL)) {
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
    let verificationEmailSent = false;
    if (isTransactionalEmailConfigured()) {
      const appUrl = process.env.APP_URL || new URL(request.url).origin;
      const verificationUrl = new URL(`/auth/verify?token=${encodeURIComponent(verificationToken)}`, appUrl).toString();
      try {
        await sendTransactionalEmail({ to: user.email, subject: "Verify your Kora account", text: `Verify your email address within 24 hours: ${verificationUrl}`, html: `<p>Verify your Kora account within 24 hours.</p><p><a href="${verificationUrl}">Verify email address</a></p>` });
        verificationEmailSent = true;
      } catch (error) {
        console.error("Account created but verification email delivery failed.", error);
      }
    }
    if (isProductionRuntime() && !verificationEmailSent) {
      return NextResponse.json({ error: "Your workspace was created, but the verification email could not be delivered. Request a new verification link before signing in." }, { status: 502 });
    }
    if (isProductionRuntime()) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        needsVerification: true,
        verificationEmailSent: true,
        message: "Workspace created. Verify your email before signing in.",
      }, { status: 201 });
    }
    const response = NextResponse.json({ success: true, authenticated: true, needsVerification: true, verificationEmailSent, message: verificationEmailSent ? "Workspace created. Check your email when convenient to verify your account." : "Workspace created. Email verification is pending, but you can continue into your workspace.", ...(!isTransactionalEmailConfigured() ? { developmentVerificationUrl: `/auth/verify?token=${encodeURIComponent(verificationToken)}` } : {}) }, { status: 201 });
    return await setSessionCookie(response, { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
  } catch (error) {
    console.error("Sign-up failed.", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
