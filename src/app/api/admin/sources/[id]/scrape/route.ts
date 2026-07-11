import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { appUrl } from "@/lib/env";
import { runScrape } from "@/lib/scrapers";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin && origin !== new URL(appUrl()).origin) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await runScrape({ sourceIds: [id], includeDisabled: true, force: true });
  return NextResponse.json({ ok: true, result });
}
