import { scoreOpportunity } from "./classifier";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from "./defaults";
import { scrapeSource } from "./scrapers";
import type { OpportunityWithRecommendation } from "./types";

export async function runLiveScrape() {
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

  const rows: OpportunityWithRecommendation[] = scraped.map((item, index) => {
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
    const recommendation = scoreOpportunity(opportunity, DEFAULT_SETTINGS);

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
    recommendations: rows.length,
    sources: sourceSummaries,
    items: rows.slice(0, 20)
  };
}
