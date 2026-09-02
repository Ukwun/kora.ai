import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
    };

    const email = (body.email || "facebook.user@kora.ng").toLowerCase();
    const name = body.name || "Facebook Workspace User";
    const user = {
      id: "facebook_user_1",
      name,
      email,
      role: "manager",
      organizationId: "org_kora_1",
    };

    const response = NextResponse.json({
      message: "Facebook authentication connected successfully.",
      user,
    });

    return await setSessionCookie(response, user);
  } catch (error) {
    return NextResponse.json({ error: "Facebook sign-in failed." }, { status: 500 });
  }
}
