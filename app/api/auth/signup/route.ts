import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createUser, findUserByEmail, readDatabase } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

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

    const normalizedEmail = email.toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json({ error: "Account already exists." }, { status: 409 });
    }

    const db = await readDatabase();
    const organization = db.organizations[0] ?? null;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      name,
      email: normalizedEmail,
      passwordHash,
      role: "owner",
      organizationId: organization?.id ?? "org_kora_1",
    });

    const response = NextResponse.json({
      message: "Account created successfully.",
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
  } catch (error) {
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
