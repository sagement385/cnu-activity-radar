"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase";

export type SaveSettingsState = {
  ok: boolean;
  message: string;
  savedAt: string | null;
};

const scheduleItemSchema = z.object({
  title: z.string().trim().min(1).max(80),
  days: z.array(z.string().min(1).max(4)).max(7),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().max(50).optional(),
  adjustable: z.boolean(),
  active: z.boolean()
});

const settingsSchema = z.object({
  profile: z.object({
    school: z.string().trim().min(1).max(80),
    college: z.string().trim().max(80).optional(),
    department: z.string().trim().min(1).max(80),
    grade: z.string().max(20).optional(),
    enrollment_status: z.string().max(30).optional(),
    region: z.string().trim().min(1).max(50),
    movable_regions: z.array(z.string().max(50)).max(12).optional(),
    max_travel_minutes: z.number().int().min(0).max(360).optional(),
    target: z.string().max(300).optional(),
    desired_career: z.string().max(200).optional(),
    desired_roles: z.array(z.string().max(80)).max(30).optional()
  }),
  schedule: z.object({
    mode: z.literal("flexible"),
    unavailable_times: z.array(scheduleItemSchema).max(30),
    activity_modes: z.array(z.string().max(50)).max(10).optional(),
    weekday_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    weekday_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    weekend_days: z.array(z.string().max(4)).max(7).optional(),
    conflict_rule: z.enum(["exclude", "penalty", "review"]).optional(),
    unclear_schedule_rule: z.enum(["exclude", "review", "allow"]).optional(),
    flexible_bonus: z.boolean().optional(),
    rules: z.record(z.string()).optional()
  }),
  preferences: z.object({
    include_categories: z.array(z.string().max(80)).max(30),
    excluded_categories: z.array(z.string().max(80)).max(30),
    category_modes: z.record(z.enum(["include", "low", "exclude"])).optional(),
    interest_keywords: z.array(z.object({ keyword: z.string().trim().min(1).max(60), level: z.enum(["very_high", "high", "normal", "low", "exclude"]) })).max(80).optional(),
    exclude_keywords: z.array(z.string().trim().min(1).max(80)).max(100),
    priority_keywords: z.array(z.string().trim().min(1).max(80)).max(100),
    review_keywords: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    avoid_sns_core: z.boolean(),
    prefer_paid: z.boolean(),
    deadline_soon_days: z.number().int().min(1).max(30),
    max_digest_items: z.number().int().min(1).max(20)
  }),
  notification: z.object({
    channel: z.literal("kakao"),
    morning_time: z.string().regex(/^\d{2}:\d{2}$/),
    evening_time: z.string().regex(/^\d{2}:\d{2}$/),
    enabled: z.boolean(),
    morning_enabled: z.boolean().optional(),
    evening_enabled: z.boolean().optional(),
    minimum_score: z.number().int().min(0).max(100).optional(),
    include_maybe: z.boolean().optional(),
    prevent_duplicates: z.boolean().optional(),
    alert_types: z.array(z.string().max(60)).max(10).optional()
  }),
  recommendation: z.object({
    weights: z.object({
      major_match: z.number().int().min(0).max(100),
      interest_match: z.number().int().min(0).max(100),
      location_match: z.number().int().min(0).max(100),
      schedule_match: z.number().int().min(0).max(100),
      benefit_match: z.number().int().min(0).max(100),
      source_reliability: z.number().int().min(0).max(100)
    }),
    adjustments: z.record(z.number().int().min(-100).max(100)),
    min_recommend_score: z.number().int().min(0).max(100)
  })
});

const sourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{3,80}$/),
  name: z.string().trim().min(2).max(100),
  url: z.string().url().refine((value) => /^https?:\/\//.test(value), "HTTP(S) URL만 사용할 수 있습니다."),
  organization: z.string().trim().min(1).max(100),
  source_group: z.string().trim().min(1).max(80),
  source_type: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  priority: z.number().int().min(1).max(10),
  crawl_method: z.string().trim().min(1).max(40),
  crawl_interval_minutes: z.number().int().min(30).max(10080),
  parser_config: z.record(z.unknown()).optional()
});

async function isAuthorized() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function saveSettings(_previous: SaveSettingsState, formData: FormData): Promise<SaveSettingsState> {
  if (!(await isAuthorized())) return { ok: false, message: "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.", savedAt: null };

  try {
    const parsedSettings = settingsSchema.parse(JSON.parse(String(formData.get("settings_json") ?? "{}")));
    const parsedSources = z.array(sourceSchema).max(50).parse(JSON.parse(String(formData.get("sources_json") ?? "[]")));
    const weightTotal = Object.values(parsedSettings.recommendation.weights).reduce((sum, value) => sum + value, 0);
    if (weightTotal !== 100) return { ok: false, message: `추천 가중치 합계가 ${weightTotal}%입니다. 100%로 맞춰 주세요.`, savedAt: null };

    const categoryModes = parsedSettings.preferences.category_modes ?? {};
    parsedSettings.preferences.include_categories = Object.entries(categoryModes).filter(([, mode]) => mode !== "exclude").map(([category]) => category);
    parsedSettings.preferences.excluded_categories = Object.entries(categoryModes).filter(([, mode]) => mode === "exclude").map(([category]) => category);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const [{ error: settingsError }, { error: sourcesError }] = await Promise.all([
      supabase.from("app_settings").upsert({ id: "default", ...parsedSettings, updated_at: now }, { onConflict: "id" }),
      supabase.from("sources").upsert(parsedSources.map((source) => ({
        ...source,
        list_url: source.url,
        base_url: new URL(source.url).origin,
        updated_at: now
      })), { onConflict: "id" })
    ]);
    if (settingsError) throw settingsError;
    if (sourcesError) throw sourcesError;

    revalidatePath("/");
    revalidatePath("/opportunities");
    revalidatePath("/settings");
    return { ok: true, message: "설정을 저장했습니다. 다음 수집·추천·알림부터 적용됩니다.", savedAt: now };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, message: "고급 JSON 문법이 올바르지 않습니다.", savedAt: null };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "입력값을 확인해 주세요.", savedAt: null };
    return { ok: false, message: error instanceof Error ? error.message : "설정을 저장하지 못했습니다.", savedAt: null };
  }
}
