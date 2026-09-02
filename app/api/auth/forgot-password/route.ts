import { NextResponse } from "next/server";
import { demoAccounts, resetPasswordSchema } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid email address.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const account = demoAccounts.find((entry) => entry.email.toLowerCase() === email);

    if (!account) {
      return NextResponse.json({ error: "No account found for this email." }, { status: 404 });
    }

    return NextResponse.json({
      message: "Password reset email sent successfully.",
      account: {
        email: account.email,
        name: account.name,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Unable to process password reset request." }, { status: 500 });
  }
}
