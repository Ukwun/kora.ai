import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const protectedPaths = ["/dashboard", "/api/auth/session"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isProtected) {
    const session = await getSessionFromRequest(request);
    if (!session) {
      const redirectUrl = new URL("/", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/auth/session"],
};
