import { NextRequest, NextResponse } from "next/server";
import { runDigest } from "@/lib/digest";
import type { DigestPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret") || request.headers.get("x-cron-secret");

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const period = (request.nextUrl.searchParams.get("period") ?? "manual") as DigestPeriod;
  const result = await runDigest(period);

  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
