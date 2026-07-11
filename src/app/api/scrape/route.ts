import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scrapers";
import { shouldScrape } from "@/lib/scrape-status";
import { runLiveScrape } from "@/lib/live-scrape";
import { getSettings } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "1";

  try {
    const useSupabase = Boolean(process.env.USE_SUPABASE === "true" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const status = useSupabase ? await shouldScrape(force) : { shouldRun: true, lastScrapeAt: null, minutesSinceLastRun: null };

    if (!status.shouldRun) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "recently_scraped",
        lastScrapeAt: status.lastScrapeAt?.toISOString() ?? null,
        minutesSinceLastRun: status.minutesSinceLastRun
      });
    }

    let storageError: string | null = null;
    let result;

    if (useSupabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        result = await runScrape();
      } catch (error) {
        storageError = error instanceof Error ? error.message : "database scrape failed";
        console.error("Supabase scrape failed", error);
        result = await runLiveScrape(await getSettings());
      }
    } else {
      result = await runLiveScrape(await getSettings());
    }

    return NextResponse.json({
      ok: true,
      skipped: false,
      storageError,
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
