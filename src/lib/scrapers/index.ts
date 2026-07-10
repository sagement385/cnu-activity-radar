import { updateSourceScrapedAt, upsertOpportunities, refreshRecommendations, logRun } from "../repository";
import { getSettings, getSources } from "../supabase";
import type { ScrapedOpportunity, Source } from "../types";
import { scrapeJnuBoard, scrapeJnuEvents } from "./jnu";
import { scrapeLinkareer } from "./linkareer";

export async function scrapeSource(source: Source): Promise<ScrapedOpportunity[]> {
  if (source.id === "jnu_events") {
    return scrapeJnuEvents(source);
  }

  if (source.id === "linkareer_activity") {
    return scrapeLinkareer(source);
  }

  return scrapeJnuBoard(source);
}

export async function runScrape() {
  const settings = await getSettings();
  const sources = await getSources();
  const results: ScrapedOpportunity[] = [];
  const sourceSummaries: Array<{ sourceId: string; count: number; error?: string }> = [];

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
        error: error instanceof Error ? error.message : "unknown error"
      });
    }
  }

  const upserted = await upsertOpportunities(results);
  const recommendations = await refreshRecommendations(settings, upserted);

  await logRun("scrape", "success", {
    scraped: results.length,
    upserted: upserted.length,
    recommendations: recommendations.length,
    sources: sourceSummaries
  });

  return {
    scraped: results.length,
    upserted: upserted.length,
    recommendations: recommendations.length,
    sources: sourceSummaries
  };
}
