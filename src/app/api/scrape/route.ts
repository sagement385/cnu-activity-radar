import { NextRequest, NextResponse } from "next/server";
import { runScrape } from "@/lib/scrapers";
import { shouldScrape } from "@/lib/scrape-status";
import { runLiveScrape } from "@/lib/live-scrape";
import { getSettings } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const message = [value.message, value.code, value.details, value.hint].filter(Boolean).join(" | ");
    if (message) {
      return message;
    }

    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch {
      return "database scrape failed";
    }
  }

  return String(error || "database scrape failed");
}

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
        result = await runScrape({ force });
      } catch (error) {
        storageError = describeError(error);
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
