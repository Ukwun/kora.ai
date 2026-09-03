import { NextResponse } from "next/server";

export async function POST(request: Request) {
  return NextResponse.json(
    { error: "Facebook sign-in is not configured. Use email and password for now." },
    { status: 501 }
  );
}
