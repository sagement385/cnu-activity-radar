"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { getSupabaseAdmin } from "@/lib/supabase";

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function saveSettings(formData: FormData) {
  const scheduleText = String(formData.get("schedule") ?? "");
  const schedule = scheduleText ? JSON.parse(scheduleText) : DEFAULT_SETTINGS.schedule;
  const notification = {
    channel: "kakao",
    enabled: formData.get("notification_enabled") === "on",
    morning_time: String(formData.get("morning_time") ?? "08:00"),
    evening_time: String(formData.get("evening_time") ?? "21:00")
  };

  const payload = {
    id: "default",
    profile: {
      school: String(formData.get("school") ?? "전남대학교"),
      department: String(formData.get("department") ?? "기계공학과"),
      region: String(formData.get("region") ?? "광주"),
      target: String(formData.get("target") ?? DEFAULT_SETTINGS.profile.target)
    },
    schedule,
    preferences: {
      include_categories: splitLines(formData.get("include_categories")),
      exclude_keywords: splitLines(formData.get("exclude_keywords")),
      priority_keywords: splitLines(formData.get("priority_keywords")),
      avoid_sns_core: formData.get("avoid_sns_core") === "on",
      prefer_paid: formData.get("prefer_paid") === "on",
      deadline_soon_days: Number(formData.get("deadline_soon_days") ?? 5),
      max_digest_items: Number(formData.get("max_digest_items") ?? 5)
    },
    notification,
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });

  if (error) {
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/settings");
}
