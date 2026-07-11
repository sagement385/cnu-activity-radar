import { getSettings, getSources, getSupabaseAdmin } from "./supabase";

export type CrawlRunView = {
  id: string;
  source_id: string | null;
  started_at: string;
  finished_at: string;
  success: boolean;
  collected_count: number;
  new_count: number;
  duplicate_count: number;
  parse_failure_count: number;
  http_status: number | null;
  error_message: string | null;
};

export async function getAdminData() {
  const [settings, sources] = await Promise.all([getSettings(), getSources()]);

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: runs }, { data: opportunitySources }, { data: settingsRow }] = await Promise.all([
      supabase.from("crawl_runs").select("*").order("started_at", { ascending: false }).limit(80),
      supabase.from("opportunities").select("source_id"),
      supabase.from("app_settings").select("updated_at").eq("id", "default").single()
    ]);
    const counts = new Map<string, number>();
    for (const row of opportunitySources ?? []) {
      if (row.source_id) counts.set(row.source_id, (counts.get(row.source_id) ?? 0) + 1);
    }

    return {
      settings,
      sources: sources.map((source) => ({ ...source, stored_count: counts.get(source.id) ?? 0 })),
      runs: (runs ?? []) as CrawlRunView[],
      lastSavedAt: settingsRow?.updated_at ?? null
    };
  } catch {
    return {
      settings,
      sources: sources.map((source) => ({ ...source, stored_count: 0 })),
      runs: [] as CrawlRunView[],
      lastSavedAt: null
    };
  }
}
