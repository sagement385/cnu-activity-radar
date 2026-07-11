import { daysUntil } from "./date";
import { logRun, markRecommendationsNotified } from "./repository";
import { runScrape } from "./scrapers";
import { sendKakaoMessage } from "./kakao";
import { getSettings } from "./supabase";
import { getSupabaseAdmin } from "./supabase";
import type { AppSettings, DigestPeriod, OpportunityRow, OpportunityWithRecommendation } from "./types";
import { truncate } from "./text";

type RecommendationRow = {
  opportunity_id: string;
  score: number;
  status: "recommend" | "maybe" | "exclude";
  reasons: string[];
  warnings: string[];
  excluded_reasons: string[];
  schedule_conflict: string;
  sns_required: boolean;
  is_paid: boolean;
  is_major_relevant: boolean;
  score_breakdown?: Record<string, number>;
  last_notified_at: string | null;
  notification_count: number;
};

export async function runDigest(period: DigestPeriod = "manual") {
  const scrapeResult = await runScrape();
  const settings = await getSettings();
  const items = await selectDigestItems(period, settings);
  const message = buildDigestMessage(period, items, scrapeResult, settings.notification.alert_types?.includes("collection_failure") ?? false);
  const opportunityIds = items.map((item) => item.id);
  let sendResult: unknown = null;
  let success = true;
  let errorMessage = "";

  try {
    const periodEnabled = period === "morning"
      ? settings.notification.morning_enabled !== false
      : period === "evening" ? settings.notification.evening_enabled !== false : true;
    if (settings.notification.enabled && periodEnabled && items.length > 0) {
      sendResult = await sendKakaoMessage(message);
      await markRecommendationsNotified(opportunityIds);
    }
  } catch (error) {
    success = false;
    errorMessage = error instanceof Error ? error.message : "unknown error";
  }

  await recordNotification(period, opportunityIds, message, success, errorMessage);
  await logRun("digest", success ? "success" : "error", {
    period,
    selected: items.length,
    scrapeResult,
    sendResult,
    errorMessage
  });

  if (!success) {
    throw new Error(errorMessage);
  }

  return {
    period,
    selected: items.length,
    message,
    scrapeResult,
    sendResult
  };
}

export async function selectDigestItems(period: DigestPeriod, settings: AppSettings) {
  const supabase = getSupabaseAdmin();
  const allowedStatuses = settings.notification.include_maybe ? ["recommend", "maybe"] : ["recommend"];
  const { data: recs, error: recError } = await supabase
    .from("recommendations")
    .select("*")
    .eq("settings_id", "default")
    .in("status", allowedStatuses)
    .gte("score", settings.notification.minimum_score ?? settings.recommendation?.min_recommend_score ?? 70)
    .order("score", { ascending: false })
    .limit(80);

  if (recError) {
    throw recError;
  }

  const recommendationRows = (recs ?? []) as RecommendationRow[];
  const opportunityIds = recommendationRows.map((rec) => rec.opportunity_id);

  if (!opportunityIds.length) {
    return [];
  }

  const { data: opportunities, error: opportunityError } = await supabase
    .from("opportunities")
    .select("*")
    .in("id", opportunityIds);

  if (opportunityError) {
    throw opportunityError;
  }

  const opportunitiesById = new Map((opportunities ?? []).map((row) => [row.id, row as OpportunityRow]));
  const now = Date.now();
  const rows: OpportunityWithRecommendation[] = recommendationRows
    .map((rec) => {
      const opportunity = opportunitiesById.get(rec.opportunity_id);

      if (!opportunity) {
        return null;
      }

      return {
        ...opportunity,
        recommendation: rec
      };
    })
    .filter(Boolean) as OpportunityWithRecommendation[];

  const filtered = rows.filter((row) => {
    const lastNotifiedAt = row.recommendation?.last_notified_at ? new Date(row.recommendation.last_notified_at).getTime() : 0;
    const hoursSinceNotify = lastNotifiedAt ? (now - lastNotifiedAt) / (1000 * 60 * 60) : Infinity;
    const remaining = daysUntil(row.deadline);

    if (remaining !== null && remaining < 0) {
      return false;
    }

    const duplicateAllowed = settings.notification.prevent_duplicates === false;
    if (period === "evening") {
      return (remaining !== null && remaining <= settings.preferences.deadline_soon_days && (duplicateAllowed || hoursSinceNotify >= 20)) || hoursSinceNotify === Infinity;
    }

    return duplicateAllowed || hoursSinceNotify === Infinity;
  });

  return filtered.slice(0, settings.preferences.max_digest_items);
}

export function buildDigestMessage(
  period: DigestPeriod,
  items: OpportunityWithRecommendation[],
  scrapeResult?: { scraped: number; upserted: number; sources?: Array<{ sourceId: string; error?: string }> },
  includeCollectionFailures = false
) {
  const header = period === "morning" ? "[아침 활동 레이더]" : period === "evening" ? "[저녁 마감 체크]" : "[활동 레이더]";
  const failedSources = includeCollectionFailures ? (scrapeResult?.sources ?? []).filter((source) => source.error) : [];

  if (!items.length) {
    return `${header}\n\n오늘 새로 보낼 만한 맞춤 공고는 아직 없어요.\n수집 공고: ${scrapeResult?.scraped ?? 0}개${failedSources.length ? `\n수집 확인 필요: ${failedSources.map((source) => source.sourceId).join(", ")}` : ""}`;
  }

  const lines = [
    header,
    "",
    period === "evening" ? `놓치면 아까운 공고 ${items.length}개` : `오늘 볼 만한 공고 ${items.length}개`,
    ""
  ];

  items.forEach((item, index) => {
    const remaining = daysUntil(item.deadline);
    const deadlineText = item.deadline ? `${item.deadline}${remaining !== null ? `, D-${Math.max(remaining, 0)}` : ""}` : "확인 필요";
    const reason = item.recommendation?.reasons?.[0] ?? item.summary ?? "조건에 맞는 활동으로 분류됨";
    const warning = item.recommendation?.warnings?.[0] ? `\n주의: ${item.recommendation.warnings[0]}` : "";

    lines.push(`${index + 1}. ${truncate(item.title, 42)}`);
    lines.push(`분류: ${item.category} / 점수: ${item.recommendation?.score ?? "-"}점`);
    lines.push(`마감: ${deadlineText}`);
    lines.push(`이유: ${truncate(reason, 72)}${warning}`);
    lines.push(`링크: ${item.original_url}`);
    lines.push("");
  });

  if (failedSources.length) {
    lines.push(`수집 확인 필요: ${failedSources.map((source) => source.sourceId).join(", ")}`);
  }
  return lines.join("\n").trim();
}

async function recordNotification(period: DigestPeriod, opportunityIds: string[], message: string, success: boolean, errorMessage: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from("notification_logs").insert({
    settings_id: "default",
    period,
    channel: "kakao",
    opportunity_ids: opportunityIds,
    message_preview: message.slice(0, 1000),
    success,
    error_message: errorMessage || null
  });
}
