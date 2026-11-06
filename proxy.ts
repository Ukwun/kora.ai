import { NextRequest, NextResponse } from "next/server";
import { getSessionClaimsFromRequest } from "@/lib/session-token";
import { checkDistributedRateLimit, getClientIP } from "@/lib/rate-limit";

const protectedPaths = ["/dashboard"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRequest = pathname.startsWith("/api/");
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const sessionClaims = isApiRequest || isProtected
    ? await getSessionClaimsFromRequest(request)
    : null;
  if (isApiRequest) {
    try {
      const identifier = sessionClaims?.id ?? getClientIP(request);
      if (!(await checkDistributedRateLimit(`api:${identifier}`, 600, 60))) {
        return NextResponse.json({ error: "Too many requests. Try again shortly." }, {
          status: 429,
          headers: { "Retry-After": "60", "Cache-Control": "no-store" },
        });
      }
    } catch (error) {
      console.error("Distributed API rate limiting is unavailable.", error instanceof Error ? error.name : "Unknown error");
      if (pathname !== "/api/health") {
        return NextResponse.json({ error: "Service temporarily unavailable." }, {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        });
      }
    }
  }
  if (isProtected && !sessionClaims) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/api/:path*"] };
