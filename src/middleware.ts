import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "./lib/admin-session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = pathname === "/settings" || pathname.startsWith("/settings/") || pathname.startsWith("/api/admin/");

  if (!protectedPath) return NextResponse.next();

  const authenticated = await verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const loginUrl = new URL("/admin", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/settings/:path*", "/api/admin/:path*"]
};
