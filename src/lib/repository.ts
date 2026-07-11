import { classifyCategory, scoreOpportunity } from "./classifier";
import { getSupabaseAdmin } from "./supabase";
import type { AppSettings, OpportunityRow, ScrapedOpportunity } from "./types";
import { toDateOnly, todayKst } from "./date";
import { canonicalOpportunityKey, mergeDuplicateItems } from "./dedupe";

function describeDatabaseError(error: unknown) {
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
      return "unknown database error";
    }
  }

  return String(error || "unknown database error");
}

function isUsablePosterUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const lowered = value.toLowerCase();
  return !lowered.startsWith("data:") && !lowered.includes("icon_file") && !lowered.includes("placeholder");
}

export async function upsertOpportunities(items: ScrapedOpportunity[]) {
  const uniqueItems = mergeDuplicateItems(items);
  if (!uniqueItems.length) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const stableKeys = uniqueItems.map((item) => item.stableKey);
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("opportunities")
    .select("stable_key, poster_url")
    .in("stable_key", stableKeys);
  if (existingRowsError) {
    throw new Error(`load existing opportunities failed: ${describeDatabaseError(existingRowsError)}`);
  }
  const existingPosterByKey = new Map((existingRows ?? []).map((row) => [row.stable_key as string, row.poster_url as string | null]));
  const rows = uniqueItems.map((item) => ({
    stable_key: item.stableKey,
    canonical_key: canonicalOpportunityKey(item),
    title: item.title,
    original_title: item.title,
    source_id: item.sourceId,
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    original_url: item.originalUrl,
    poster_url: item.posterUrl ?? (isUsablePosterUrl(existingPosterByKey.get(item.stableKey)) ? existingPosterByKey.get(item.stableKey) : null),
    organization: item.organization ?? null,
    category: item.category ?? classifyCategory(`${item.title} ${item.rawText}`),
    sub_category: item.subCategory ?? null,
    campus_scope: item.campusScope ?? (item.sourceId.startsWith("jnu_") ? "교내" : "교외"),
    target: item.target ?? [],
    allowed_grades: item.allowedGrades ?? [],
    allowed_majors: item.allowedMajors ?? [],
    location: item.location ?? null,
    region: item.location ?? null,
    activity_type: item.activityType ?? "미확인",
    deadline: item.deadline ?? null,
    application_deadline: item.deadline ?? null,
    recruitment_start: item.recruitmentStart ?? null,
    application_start: item.recruitmentStart ?? null,
    activity_start: item.activityStart ?? null,
    activity_end: item.activityEnd ?? null,
    benefits: item.benefits ?? null,
    requirements: item.requirements ?? null,
    summary: item.summary ?? null,
    description: item.summary ?? null,
    eligibility_status: item.eligibilityStatus ?? "조건 확인 필요",
    deadline_confidence: item.deadlineConfidence ?? (item.deadline ? "high" : "low"),
    data_confidence: item.dataConfidence ?? "medium",
    raw_text: item.rawText,
    tags: item.tags ?? [],
    last_seen_at: now,
    updated_at: now
  }));

  const { data, error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "stable_key" })
    .select("*");

  if (error) {
    throw new Error(`upsert opportunities failed: ${describeDatabaseError(error)}`);
  }

  const opportunityRows = (data ?? []) as OpportunityRow[];
  const opportunityByStableKey = new Map(opportunityRows.map((row) => [row.stable_key, row]));
  const sourceRows = uniqueItems.flatMap((item) => {
    const opportunity = opportunityByStableKey.get(item.stableKey);
    if (!opportunity) return [];
    return (item.sourceRefs ?? [{ sourceId: item.sourceId, sourceName: item.sourceName, sourceUrl: item.sourceUrl, originalUrl: item.originalUrl }]).map((ref) => ({
      opportunity_id: opportunity.id,
      source_id: ref.sourceId,
      source_name: ref.sourceName,
      source_url: ref.sourceUrl,
      original_url: ref.originalUrl,
      last_seen_at: now
    }));
  });

  if (sourceRows.length) {
    const { error: sourceError } = await supabase
      .from("opportunity_sources")
      .upsert(sourceRows, { onConflict: "opportunity_id,source_id,original_url" });
    if (sourceError) throw new Error(`upsert opportunity sources failed: ${describeDatabaseError(sourceError)}`);
  }

  return opportunityRows;
}

export async function getExistingStableKeys(items: ScrapedOpportunity[]) {
  if (!items.length) return new Set<string>();
  const supabase = getSupabaseAdmin();
  const keys = items.map((item) => item.stableKey);
  const existing = new Set<string>();

  for (let index = 0; index < keys.length; index += 100) {
    const { data, error } = await supabase.from("opportunities").select("stable_key").in("stable_key", keys.slice(index, index + 100));
    if (error) throw new Error(`load existing stable keys failed: ${describeDatabaseError(error)}`);
    for (const row of data ?? []) existing.add(row.stable_key);
  }
  return existing;
}

export async function refreshRecommendations(settings: AppSettings, opportunities: OpportunityRow[], curatedRecommendations?: Map<string, ReturnType<typeof scoreOpportunity>>) {
  if (!opportunities.length) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const rows = opportunities.map((opportunity) => {
    const result = curatedRecommendations?.get(opportunity.stable_key) ?? scoreOpportunity(opportunity, settings);

    return {
      opportunity_id: opportunity.id,
      settings_id: settings.id,
      score: result.score,
      status: result.status,
      reasons: result.reasons,
      warnings: result.warnings,
      excluded_reasons: result.excluded_reasons,
      schedule_conflict: result.schedule_conflict,
      sns_required: result.sns_required,
      is_paid: result.is_paid,
      is_major_relevant: result.is_major_relevant,
      score_breakdown: result.score_breakdown,
      updated_at: new Date().toISOString()
    };
  });

  const { data, error } = await supabase
    .from("recommendations")
    .upsert(rows, { onConflict: "opportunity_id,settings_id" })
    .select("*");

  if (error) {
    throw new Error(`refresh recommendations failed: ${describeDatabaseError(error)}`);
  }

  return data ?? [];
}

export async function deleteExpiredOpportunities() {
  const supabase = getSupabaseAdmin();
  const today = toDateOnly(todayKst());
  const { data, error } = await supabase.from("opportunities").delete().lt("deadline", today).select("id");

  if (error) {
    throw new Error(`delete expired opportunities failed: ${describeDatabaseError(error)}`);
  }

  return data?.length ?? 0;
}

export async function updateSourceScrapedAt(sourceId: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from("sources").update({ last_scraped_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", sourceId);
}

export async function recordSourceRun(input: {
  sourceId: string;
  startedAt: string;
  finishedAt: string;
  success: boolean;
  collectedCount: number;
  newCount?: number;
  duplicateCount?: number;
  parseFailureCount?: number;
  httpStatus?: number | null;
  errorMessage?: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const now = input.finishedAt;
  const sourceUpdate = input.success
    ? {
        last_scraped_at: now,
        last_success_at: now,
        last_error: null,
        last_item_count: input.collectedCount,
        last_new_count: input.newCount ?? 0,
        updated_at: now
      }
    : {
        last_scraped_at: now,
        last_failure_at: now,
        last_error: input.errorMessage ?? "unknown error",
        last_item_count: 0,
        last_new_count: 0,
        updated_at: now
      };

  const [{ error: sourceError }, { error: runError }] = await Promise.all([
    supabase.from("sources").update(sourceUpdate).eq("id", input.sourceId),
    supabase.from("crawl_runs").insert({
      source_id: input.sourceId,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      success: input.success,
      collected_count: input.collectedCount,
      new_count: input.newCount ?? 0,
      duplicate_count: input.duplicateCount ?? 0,
      parse_failure_count: input.parseFailureCount ?? 0,
      http_status: input.httpStatus ?? null,
      error_message: input.errorMessage ?? null
    })
  ]);

  if (sourceError) throw new Error(`update source status failed: ${describeDatabaseError(sourceError)}`);
  if (runError) throw new Error(`record source run failed: ${describeDatabaseError(runError)}`);
}

export async function logRun(runType: string, status: "success" | "error", detail: Record<string, unknown>) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("run_logs").insert({
      run_type: runType,
      status,
      detail
    });
  } catch {
    // Logging must not break the scheduled job.
  }
}

export async function markRecommendationsNotified(opportunityIds: string[]) {
  if (!opportunityIds.length) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  for (const opportunityId of opportunityIds) {
    const { data } = await supabase
      .from("recommendations")
      .select("notification_count")
      .eq("opportunity_id", opportunityId)
      .eq("settings_id", "default")
      .single();

    await supabase
      .from("recommendations")
      .update({
        last_notified_at: now,
        notification_count: (data?.notification_count ?? 0) + 1,
        updated_at: now
      })
      .eq("opportunity_id", opportunityId)
      .eq("settings_id", "default");
  }
}
