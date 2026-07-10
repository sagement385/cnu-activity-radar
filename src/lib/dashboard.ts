import { getSupabaseAdmin } from "./supabase";
import type { OpportunityRow, OpportunityWithRecommendation } from "./types";
import { toDateOnly, todayKst } from "./date";

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
  last_notified_at: string | null;
  notification_count: number;
};

export async function getDashboardData() {
  try {
    const supabase = getSupabaseAdmin();
    const [{ data: recs }, { data: opportunities }, { data: logs }, { data: settings }] = await Promise.all([
      supabase.from("recommendations").select("*").eq("settings_id", "default").order("score", { ascending: false }).limit(120),
      supabase.from("opportunities").select("*").or(`deadline.is.null,deadline.gte.${toDateOnly(todayKst())}`).order("last_seen_at", { ascending: false }).limit(120),
      supabase.from("notification_logs").select("*").order("sent_at", { ascending: false }).limit(8),
      supabase.from("app_settings").select("*").eq("id", "default").single()
    ]);

    const recommendations = (recs ?? []) as RecommendationRow[];
    const recommendationByOpportunityId = new Map(recommendations.map((rec) => [rec.opportunity_id, rec]));
    const rows = ((opportunities ?? []) as OpportunityRow[]).map((opportunity) => ({
      ...opportunity,
      recommendation: recommendationByOpportunityId.get(opportunity.id)
    })) as OpportunityWithRecommendation[];

    return {
      ok: true as const,
      rows,
      logs: logs ?? [],
      settings: settings ?? null,
      stats: {
        recommend: recommendations.filter((rec) => rec.status === "recommend").length,
        maybe: recommendations.filter((rec) => rec.status === "maybe").length,
        exclude: recommendations.filter((rec) => rec.status === "exclude").length,
        total: rows.length
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "환경변수 또는 DB 연결을 확인해야 합니다.",
      rows: [],
      logs: [],
      settings: null,
      stats: {
        recommend: 0,
        maybe: 0,
        exclude: 0,
        total: 0
      }
    };
  }
}
