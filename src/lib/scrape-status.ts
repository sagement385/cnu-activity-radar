import { getSupabaseAdmin } from "./supabase";

export async function getLastScrapeAt() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("run_logs")
    .select("created_at")
    .eq("run_type", "scrape")
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.created_at ? new Date(data.created_at) : null;
}

export async function shouldScrape(force = false) {
  if (force) {
    return { shouldRun: true, lastScrapeAt: null, minutesSinceLastRun: null };
  }

  const minInterval = Number(process.env.SCRAPE_MIN_INTERVAL_MINUTES ?? 60);
  const lastScrapeAt = await getLastScrapeAt();

  if (!lastScrapeAt) {
    return { shouldRun: true, lastScrapeAt: null, minutesSinceLastRun: null };
  }

  const minutesSinceLastRun = Math.floor((Date.now() - lastScrapeAt.getTime()) / (1000 * 60));

  return {
    shouldRun: minutesSinceLastRun >= minInterval,
    lastScrapeAt,
    minutesSinceLastRun
  };
}
