import { classifyCategory, scoreOpportunity } from "./classifier";
import { getSupabaseAdmin } from "./supabase";
import type { AppSettings, OpportunityRow, ScrapedOpportunity } from "./types";
import { toDateOnly, todayKst } from "./date";

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

function mergeDuplicateItems(items: ScrapedOpportunity[]) {
  const byStableKey = new Map<string, ScrapedOpportunity>();

  for (const item of items) {
    const existing = byStableKey.get(item.stableKey);
    if (!existing) {
      byStableKey.set(item.stableKey, item);
      continue;
    }

    const preferred = item.rawText.length >= existing.rawText.length ? item : existing;
    const other = preferred === item ? existing : item;
    byStableKey.set(item.stableKey, {
      ...other,
      ...preferred,
      title: preferred.title.length >= other.title.length ? preferred.title : other.title,
      summary: preferred.summary ?? other.summary,
      rawText: preferred.rawText,
      posterUrl: preferred.posterUrl ?? other.posterUrl,
      tags: [...new Set([...(other.tags ?? []), ...(preferred.tags ?? [])])]
    });
  }

  return [...byStableKey.values()];
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
    title: item.title,
    source_id: item.sourceId,
    source_name: item.sourceName,
    source_url: item.sourceUrl,
    original_url: item.originalUrl,
    poster_url: item.posterUrl ?? (isUsablePosterUrl(existingPosterByKey.get(item.stableKey)) ? existingPosterByKey.get(item.stableKey) : null),
    organization: item.organization ?? null,
    category: item.category ?? classifyCategory(`${item.title} ${item.rawText}`),
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

  return (data ?? []) as OpportunityRow[];
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
