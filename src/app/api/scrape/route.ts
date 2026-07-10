import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scrapers";
import { shouldScrape } from "@/lib/scrape-status";
import { runLiveScrape } from "@/lib/live-scrape";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const status = await shouldScrape(force);

    if (!status.shouldRun) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "recently_scraped",
        lastScrapeAt: status.lastScrapeAt?.toISOString() ?? null,
        minutesSinceLastRun: status.minutesSinceLastRun
      });
    }

    const result = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? await runScrape().catch(runLiveScrape) : await runLiveScrape();

    return NextResponse.json({
      ok: true,
      skipped: false,
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error"
      },
      { status: 500 }
    );
  }
}
