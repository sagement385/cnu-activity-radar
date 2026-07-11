import { upsertOpportunities, refreshRecommendations, logRun, deleteExpiredOpportunities, getExistingStableKeys, recordSourceRun } from "../repository";
import { getSettings, getSources } from "../supabase";
import type { ScrapedOpportunity, Source } from "../types";
import { scrapeJnuBoard, scrapeJnuEvents, scrapeRegistryBoard } from "./jnu";
import { scrapeLinkareer } from "./linkareer";
import { scrapeExternal } from "./external";
import { curateScrapedOpportunities } from "../curation";
import { isExpired } from "../date";
import { mergeDuplicateItems } from "../dedupe";

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

  if (source.crawl_method === "registry_html") {
    return scrapeRegistryBoard(source);
  }

  if (source.source_type === "external") {
    return scrapeExternal(source);
  }

  return scrapeJnuBoard(source);
}

async function safeRecordSourceRun(input: Parameters<typeof recordSourceRun>[0]) {
  try {
    await recordSourceRun(input);
  } catch {
    // Source logging must not stop other sources from being collected.
  }
}

function isSourceDue(source: Source, force = false) {
  if (force || !source.last_success_at) return true;
  const elapsedMinutes = (Date.now() - new Date(source.last_success_at).getTime()) / 60000;
  return elapsedMinutes >= (source.crawl_interval_minutes ?? 360);
}

export async function runScrape(options: { sourceIds?: string[]; includeDisabled?: boolean; force?: boolean } = {}) {
  let stage = "load settings";

  try {
    const settings = await getSettings();
    const sources = await getSources();
    const results: ScrapedOpportunity[] = [];
    const sourceSummaries: Array<{ sourceId: string; count: number; newCount?: number; duplicateCount?: number; error?: string }> = [];
    const successfulRuns: Array<{ sourceId: string; startedAt: string; finishedAt: string; items: ScrapedOpportunity[] }> = [];

    stage = "delete expired opportunities";
    const deleted = await deleteExpiredOpportunities();

    const selectedSources = sources.filter((item) => (item.enabled || options.includeDisabled) && (!options.sourceIds?.length || options.sourceIds.includes(item.id)) && isSourceDue(item, options.force));
    for (const source of selectedSources) {
      const startedAt = new Date().toISOString();
      try {
        const items = await scrapeSource(source);
        results.push(...items);
        sourceSummaries.push({ sourceId: source.id, count: items.length });
        successfulRuns.push({ sourceId: source.id, startedAt, finishedAt: new Date().toISOString(), items });
      } catch (error) {
        const message = describeScrapeError(error);
        sourceSummaries.push({
          sourceId: source.id,
          count: 0,
          error: message
        });
        await safeRecordSourceRun({
          sourceId: source.id,
          startedAt,
          finishedAt: new Date().toISOString(),
          success: false,
          collectedCount: 0,
          errorMessage: message,
          httpStatus: Number(message.match(/:\s*(\d{3})\b/)?.[1] ?? 0) || null
        });
      }
    }

    stage = "filter expired scrape results";
    const activeResults = mergeDuplicateItems(results.filter((item) => !item.deadline || !isExpired(item.deadline)));

    stage = "curate scrape results";
    const curated = await curateScrapedOpportunities(activeResults, settings);

    stage = "upsert opportunities";
    const existingKeys = await getExistingStableKeys(curated.map((item) => item.item));
    const upserted = await upsertOpportunities(curated.map((item) => item.item));
    const recommendationByStableKey = new Map(curated.map((item) => [item.item.stableKey, item.recommendation]));

    stage = "refresh recommendations";
    const recommendations = await refreshRecommendations(settings, upserted, recommendationByStableKey);

    stage = "record source runs";
    for (const run of successfulRuns) {
      const newCount = run.items.filter((item) => !existingKeys.has(item.stableKey)).length;
      const summary = sourceSummaries.find((item) => item.sourceId === run.sourceId);
      if (summary) {
        summary.newCount = newCount;
        summary.duplicateCount = Math.max(0, run.items.length - newCount);
      }
      await safeRecordSourceRun({
        sourceId: run.sourceId,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        success: true,
        collectedCount: run.items.length,
        newCount,
        duplicateCount: Math.max(0, run.items.length - newCount)
      });
    }

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
