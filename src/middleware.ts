import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  const pathname = request.nextUrl.pathname;
  const settingsPath = pathname === "/settings" || pathname.startsWith("/settings/");

  if (!secret || secret === "disabled" || !settingsPath || pathname === "/admin" || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const cookieSecret = request.cookies.get("dashboard_secret")?.value;
  if (cookieSecret === secret) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
