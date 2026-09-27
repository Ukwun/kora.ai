import { NextRequest, NextResponse } from "next/server";
import { getSessionClaimsFromRequest } from "@/lib/session-token";

const protectedPaths = ["/dashboard", "/api/auth/session"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (isProtected && !(await getSessionClaimsFromRequest(request))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/api/auth/session"] };
