import { hardExcludeReasons, scoreOpportunity, classifyCategory } from "./classifier";
import { judgeMany } from "./gemini";
import type { AppSettings, Recommendation, ScrapedOpportunity } from "./types";

export type CuratedItem = {
  item: ScrapedOpportunity;
  recommendation: Recommendation;
};

export async function curateScrapedOpportunities(items: ScrapedOpportunity[], settings: AppSettings): Promise<CuratedItem[]> {
  const normalized = items.map((item) => ({
    ...item,
    category: item.category ?? classifyCategory(`${item.title} ${item.rawText}`)
  }));

  const candidates = normalized
    .filter((item) => hardExcludeReasons(item, settings).length === 0)
    .sort((a, b) => heuristicScore(b, settings) - heuristicScore(a, settings));
  const aiJudgements = await judgeMany(candidates, settings);

  return normalized.map((item) => {
    const judgement = aiJudgements.get(item.stableKey);
    const enriched = judgement && hardExcludeReasons(item, settings).length === 0
      ? { ...item, category: judgement.category, tags: Array.from(new Set([...(item.tags ?? []), judgement.category])) }
      : item;
    const recommendation = scoreOpportunity(enriched, settings);

    if (judgement?.exclude && hardExcludeReasons(enriched, settings).length === 0) {
      recommendation.score -= Math.max(70, Math.round(judgement.confidence * 40));
      recommendation.status = "exclude";
      recommendation.excluded_reasons = Array.from(new Set([
        ...recommendation.excluded_reasons,
        ...judgement.reasons.slice(0, 2).map((reason) => `Gemini 판별: ${reason}`)
      ])).slice(0, 4);
    }

    if (judgement?.reasons.length && recommendation.status !== "exclude") {
      recommendation.reasons = Array.from(new Set([...judgement.reasons, ...recommendation.reasons])).slice(0, 5);
    }
    if (judgement?.warnings.length) {
      recommendation.warnings = Array.from(new Set([...judgement.warnings, ...recommendation.warnings])).slice(0, 4);
    }

    return {
      item: enriched,
      recommendation: {
        ...recommendation,
        opportunity_id: enriched.stableKey
      }
    };
  });
}

function heuristicScore(item: ScrapedOpportunity, settings: AppSettings) {
  return scoreOpportunity(item, settings).score;
}
