import { curateScrapedOpportunities } from "./curation";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from "./defaults";
import { scrapeSource } from "./scrapers";
import type { OpportunityWithRecommendation, AppSettings } from "./types";

export async function runLiveScrape(settings: AppSettings = DEFAULT_SETTINGS) {
  const scraped = [];
  const sourceSummaries: Array<{ sourceId: string; count: number; error?: string }> = [];

  for (const source of DEFAULT_SOURCES.filter((item) => item.enabled)) {
    try {
      const items = await scrapeSource(source);
      scraped.push(...items);
      sourceSummaries.push({ sourceId: source.id, count: items.length });
    } catch (error) {
      sourceSummaries.push({
        sourceId: source.id,
        count: 0,
        error: error instanceof Error ? error.message : "unknown error"
      });
    }
  }

  const curated = await curateScrapedOpportunities(scraped, settings);
  const rows: OpportunityWithRecommendation[] = curated.map(({ item, recommendation }, index) => {
    const opportunity = {
      id: item.stableKey,
      stable_key: item.stableKey,
      title: item.title,
      source_id: item.sourceId,
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      original_url: item.originalUrl,
      organization: item.organization ?? null,
      category: item.category ?? "대외활동",
      location: item.location ?? null,
      deadline: item.deadline ?? null,
      recruitment_start: item.recruitmentStart ?? null,
      activity_start: item.activityStart ?? null,
      activity_end: item.activityEnd ?? null,
      benefits: item.benefits ?? null,
      requirements: item.requirements ?? null,
      summary: item.summary ?? null,
      raw_text: item.rawText,
      tags: item.tags ?? [],
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };

    return {
      ...opportunity,
      id: `${item.stableKey}-${index}`,
      recommendation: {
        ...recommendation,
        opportunity_id: `${item.stableKey}-${index}`,
        last_notified_at: null,
        notification_count: 0
      }
    };
  });

  rows.sort((a, b) => (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0));

  return {
    mode: "live",
    scraped: scraped.length,
    upserted: 0,
    recommendations: rows.filter((item) => item.recommendation?.status !== "exclude").length,
    sources: sourceSummaries,
    items: rows.filter((item) => item.recommendation?.status !== "exclude").slice(0, 30)
  };
}
