import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  const pathname = request.nextUrl.pathname;

  if (!secret || secret === "disabled" || pathname === "/admin" || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const cookieSecret = request.cookies.get("dashboard_secret")?.value;
  if (cookieSecret === secret) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/admin", request.url));
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
