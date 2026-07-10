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
      preferences: data.preferences,
      notification: data.notification
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getSources(): Promise<Source[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sources").select("*").eq("enabled", true).order("source_type");

    if (error || !data?.length) {
      return DEFAULT_SOURCES;
    }

    return data.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      enabled: source.enabled
    }));
  } catch {
    return DEFAULT_SOURCES;
  }
}
