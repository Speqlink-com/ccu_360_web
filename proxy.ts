import { NextRequest, NextResponse } from "next/server";
import { authCookieNames } from "@/lib/server/auth-cookies";
import { isDemo } from "@/lib/config";
// Early redirect avoids streaming a dashboard response before the layout checks cookies.
// The gateway and backend independently verify every session and permission.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const response = NextResponse.redirect(new URL("/auth/signin", request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const names = authCookieNames();
  if (
    !isDemo &&
    !request.cookies.has(names.access) &&
    !request.cookies.has(names.refresh)
  ) {
    const response = NextResponse.redirect(new URL("/auth/signin", request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  return NextResponse.next();
}
export const config = { matcher: ["/", "/dashboard/:path*"] };
