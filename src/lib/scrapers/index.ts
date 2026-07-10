import { updateSourceScrapedAt, upsertOpportunities, refreshRecommendations, logRun, deleteExpiredOpportunities } from "../repository";
import { getSettings, getSources } from "../supabase";
import type { ScrapedOpportunity, Source } from "../types";
import { scrapeJnuBoard, scrapeJnuEvents } from "./jnu";
import { scrapeLinkareer } from "./linkareer";
import { scrapeExternal } from "./external";
import { curateScrapedOpportunities } from "../curation";

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
  const settings = await getSettings();
  const sources = await getSources();
  const results: ScrapedOpportunity[] = [];
  const sourceSummaries: Array<{ sourceId: string; count: number; error?: string }> = [];
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
        error: error instanceof Error ? error.message : "unknown error"
      });
    }
  }

  const curated = await curateScrapedOpportunities(results, settings);
  const upserted = await upsertOpportunities(curated.map((item) => item.item));
  const recommendationByStableKey = new Map(curated.map((item) => [item.item.stableKey, item.recommendation]));
  const recommendations = await refreshRecommendations(settings, upserted, recommendationByStableKey);

  await logRun("scrape", "success", {
    scraped: results.length,
    upserted: upserted.length,
    recommendations: recommendations.length,
    sources: sourceSummaries,
    deleted
  });

  return {
    scraped: results.length,
    upserted: upserted.length,
    recommendations: recommendations.length,
    sources: sourceSummaries,
    deleted
  };
}
