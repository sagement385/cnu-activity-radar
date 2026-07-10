import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET;
  const pathname = request.nextUrl.pathname;

  if (!secret || secret === "disabled" || pathname.startsWith("/_next") || pathname.startsWith("/api/cron") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const querySecret = request.nextUrl.searchParams.get("dashboard_secret");
  const cookieSecret = request.cookies.get("dashboard_secret")?.value;

  if (querySecret === secret || cookieSecret === secret) {
    const response = NextResponse.next();

    if (querySecret === secret) {
      response.cookies.set("dashboard_secret", secret, {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: 60 * 60 * 24 * 30
      });
    }

    return response;
  }

  return new NextResponse(
    "Dashboard locked. Open with ?dashboard_secret=YOUR_SECRET once to save access.",
    {
      status: 401,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    }
  );
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"]
};
