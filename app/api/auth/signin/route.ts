import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { findUserByEmail } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

const signinSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please provide a valid email and password.", details: parsed.error.flatten() }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json({ error: "No account found for this email." }, { status: 404 });
    }

    if (user.accountStatus === "suspended") {
      return NextResponse.json({ error: "This account is unavailable. Contact your workspace owner." }, { status: 403 });
    }
    if (user.emailVerified === false) {
      return NextResponse.json({ error: "Verify your email address before signing in." }, { status: 403 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
    }

    const response = NextResponse.json({
      message: "Signed in successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    });

    return await setSessionCookie(response, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });
  } catch {
    return NextResponse.json({ error: "Sign-in failed." }, { status: 500 });
  }
}
