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
      profile: {
        ...DEFAULT_SETTINGS.profile,
        ...data.profile,
        movable_regions: data.profile?.movable_regions ?? DEFAULT_SETTINGS.profile.movable_regions,
        desired_roles: data.profile?.desired_roles ?? DEFAULT_SETTINGS.profile.desired_roles
      },
      schedule: {
        ...DEFAULT_SETTINGS.schedule,
        ...data.schedule,
        unavailable_times: data.schedule?.unavailable_times ?? DEFAULT_SETTINGS.schedule.unavailable_times,
        activity_modes: data.schedule?.activity_modes ?? DEFAULT_SETTINGS.schedule.activity_modes,
        weekend_days: data.schedule?.weekend_days ?? DEFAULT_SETTINGS.schedule.weekend_days,
        rules: { ...DEFAULT_SETTINGS.schedule.rules, ...(data.schedule?.rules ?? {}) }
      },
      preferences: {
        ...DEFAULT_SETTINGS.preferences,
        ...(data.preferences ?? {}),
        include_categories: data.preferences?.include_categories ?? DEFAULT_SETTINGS.preferences.include_categories,
        excluded_categories: data.preferences?.excluded_categories ?? DEFAULT_SETTINGS.preferences.excluded_categories,
        category_modes: { ...DEFAULT_SETTINGS.preferences.category_modes, ...(data.preferences?.category_modes ?? {}) },
        interest_keywords: data.preferences?.interest_keywords ?? DEFAULT_SETTINGS.preferences.interest_keywords,
        review_keywords: data.preferences?.review_keywords ?? DEFAULT_SETTINGS.preferences.review_keywords
      },
      notification: {
        ...DEFAULT_SETTINGS.notification,
        ...(data.notification ?? {}),
        alert_types: data.notification?.alert_types ?? DEFAULT_SETTINGS.notification.alert_types
      },
      recommendation: {
        ...DEFAULT_SETTINGS.recommendation!,
        ...(data.recommendation ?? {}),
        weights: { ...DEFAULT_SETTINGS.recommendation!.weights, ...(data.recommendation?.weights ?? {}) },
        adjustments: { ...DEFAULT_SETTINGS.recommendation!.adjustments, ...(data.recommendation?.adjustments ?? {}) }
      }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getSources(): Promise<Source[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sources").select("*").order("priority", { ascending: false });

    if (error || !data?.length) {
      return DEFAULT_SOURCES;
    }

    const configured = data.map((source) => ({
      ...source,
      id: source.id,
      name: source.name,
      url: source.list_url || source.url,
      source_type: source.source_type,
      enabled: source.enabled,
      parser_config: source.parser_config ?? {}
    })) as Source[];
    const configuredById = new Map(configured.map((source) => [source.id, source]));
    const defaults = DEFAULT_SOURCES.map((source) => {
      const configuredSource = configuredById.get(source.id);
      return configuredSource
        ? { ...source, ...configuredSource, parser_config: { ...source.parser_config, ...configuredSource.parser_config } }
        : source;
    });
    const extra = configured.filter((source) => !DEFAULT_SOURCES.some((defaultSource) => defaultSource.id === source.id));
    return [...defaults, ...extra];
  } catch {
    return DEFAULT_SOURCES;
  }
}
