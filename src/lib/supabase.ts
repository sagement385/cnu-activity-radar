import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES } from "./defaults";
import { requireEnv } from "./env";
import type { AppSettings, Source } from "./types";

export function getSupabaseAdmin() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("app_settings").select("*").eq("id", "default").single();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    return {
      id: data.id,
      profile: data.profile,
      schedule: data.schedule,
      preferences: {
        ...DEFAULT_SETTINGS.preferences,
        ...data.preferences,
        excluded_categories: data.preferences.excluded_categories ?? DEFAULT_SETTINGS.preferences.excluded_categories
      },
      notification: data.notification
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getSources(): Promise<Source[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sources").select("*").order("source_type");

    if (error || !data?.length) {
      return DEFAULT_SOURCES;
    }

    const configured = data.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      enabled: source.enabled
    }));
    const configuredById = new Map(configured.map((source) => [source.id, source]));
    const defaults = DEFAULT_SOURCES.map((source) => configuredById.get(source.id) ?? source);
    const extra = configured.filter((source) => !DEFAULT_SOURCES.some((defaultSource) => defaultSource.id === source.id));
    return [...defaults, ...extra].filter((source) => source.enabled);
  } catch {
    return DEFAULT_SOURCES;
  }
}
