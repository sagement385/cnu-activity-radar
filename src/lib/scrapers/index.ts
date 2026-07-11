import { updateSourceScrapedAt, upsertOpportunities, refreshRecommendations, logRun, deleteExpiredOpportunities } from "../repository";
import { getSettings, getSources } from "../supabase";
import type { ScrapedOpportunity, Source } from "../types";
import { scrapeJnuBoard, scrapeJnuEvents } from "./jnu";
import { scrapeLinkareer } from "./linkareer";
import { scrapeExternal } from "./external";
import { curateScrapedOpportunities } from "../curation";
import { isExpired } from "../date";

function describeScrapeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const message = [value.message, value.code, value.details, value.hint].filter(Boolean).join(" | ");
    if (message) {
      return message;
    }

    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch {
      return "unknown scrape error";
    }
  }

  return String(error || "unknown scrape error");
}

export async function scrapeSource(source: Source): Promise<ScrapedOpportunity[]> {
  if (source.id === "jnu_events") {
    return scrapeJnuEvents(source);
  }

  if (source.id === "linkareer_activity") {
    return scrapeLinkareer(source);
  }

  if (source.source_type === "external") {
    return scrapeExternal(source);
  }

  return scrapeJnuBoard(source);
}

export async function runScrape() {
  let stage = "load settings";

  try {
    const settings = await getSettings();
    const sources = await getSources();
    const results: ScrapedOpportunity[] = [];
    const sourceSummaries: Array<{ sourceId: string; count: number; error?: string }> = [];

    stage = "delete expired opportunities";
    const deleted = await deleteExpiredOpportunities();

    for (const source of sources.filter((item) => item.enabled)) {
      try {
        const items = await scrapeSource(source);
        results.push(...items);
        sourceSummaries.push({ sourceId: source.id, count: items.length });
        await updateSourceScrapedAt(source.id);
      } catch (error) {
        sourceSummaries.push({
          sourceId: source.id,
          count: 0,
          error: describeScrapeError(error)
        });
      }
    }

    stage = "filter expired scrape results";
    const activeResults = results.filter((item) => !item.deadline || !isExpired(item.deadline));

    stage = "curate scrape results";
    const curated = await curateScrapedOpportunities(activeResults, settings);

    stage = "upsert opportunities";
    const upserted = await upsertOpportunities(curated.map((item) => item.item));
    const recommendationByStableKey = new Map(curated.map((item) => [item.item.stableKey, item.recommendation]));

    stage = "refresh recommendations";
    const recommendations = await refreshRecommendations(settings, upserted, recommendationByStableKey);

    await logRun("scrape", "success", {
      scraped: results.length,
      active: activeResults.length,
      upserted: upserted.length,
      recommendations: recommendations.length,
      sources: sourceSummaries,
      deleted
    });

    return {
      scraped: results.length,
      active: activeResults.length,
      upserted: upserted.length,
      recommendations: recommendations.length,
      sources: sourceSummaries,
      deleted
    };
  } catch (error) {
    throw new Error(`scrape stage "${stage}" failed: ${describeScrapeError(error)}`);
  }
}
