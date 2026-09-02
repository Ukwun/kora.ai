import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
    };

    const email = (body.email || "google.user@kora.ng").toLowerCase();
    const name = body.name || "Google Workspace User";
    const user = {
      id: "google_user_1",
      name,
      email,
      role: "owner",
      organizationId: "org_kora_1",
    };

    const response = NextResponse.json({
      message: "Google authentication connected successfully.",
      user,
    });

    return await setSessionCookie(response, user);
  } catch (error) {
    return NextResponse.json({ error: "Google sign-in failed." }, { status: 500 });
  }
}
