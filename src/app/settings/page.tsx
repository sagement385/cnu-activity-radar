import { saveSettings } from "./actions";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getDashboardData();
  const settings = data.settings
    ? {
        profile: data.settings.profile,
        schedule: data.settings.schedule,
        preferences: data.settings.preferences,
        notification: data.settings.notification
      }
    : DEFAULT_SETTINGS;

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">맞춤 조건</p>
          <h1>설정</h1>
          <p className="muted">학과, 일정, 제외 키워드, 카톡 발송 시간을 바꾸면 다음 스크랩부터 반영됩니다.</p>
        </div>
      </section>

      <form action={saveSettings} className="panel form-grid">
        <label>
          학교
          <input name="school" defaultValue={settings.profile.school} />
        </label>
        <label>
          학과
          <input name="department" defaultValue={settings.profile.department} />
        </label>
        <label>
          지역
          <input name="region" defaultValue={settings.profile.region} />
        </label>
        <label>
          목표
          <input name="target" defaultValue={settings.profile.target ?? ""} />
        </label>

        <label className="full">
          포함 카테고리
          <textarea name="include_categories" defaultValue={settings.preferences.include_categories.join("\n")} />
        </label>
        <label className="full">
          우선 키워드
          <textarea name="priority_keywords" defaultValue={settings.preferences.priority_keywords.join("\n")} />
        </label>
        <label className="full">
          제외 키워드
          <textarea name="exclude_keywords" defaultValue={settings.preferences.exclude_keywords.join("\n")} />
        </label>
        <label className="full">
          유동 스케줄 JSON
          <textarea name="schedule" defaultValue={JSON.stringify(settings.schedule, null, 2)} />
        </label>

        <label>
          아침 발송 시간
          <input name="morning_time" defaultValue={settings.notification.morning_time} />
        </label>
        <label>
          저녁 발송 시간
          <input name="evening_time" defaultValue={settings.notification.evening_time} />
        </label>
        <label>
          마감 임박 기준일
          <input name="deadline_soon_days" type="number" min="1" max="14" defaultValue={settings.preferences.deadline_soon_days} />
        </label>
        <label>
          카톡 최대 공고 수
          <input name="max_digest_items" type="number" min="1" max="10" defaultValue={settings.preferences.max_digest_items} />
        </label>

        <label>
          <span>카톡 발송 사용</span>
          <input name="notification_enabled" type="checkbox" defaultChecked={settings.notification.enabled} />
        </label>
        <label>
          <span>SNS 중심 활동 피하기</span>
          <input name="avoid_sns_core" type="checkbox" defaultChecked={settings.preferences.avoid_sns_core} />
        </label>
        <label>
          <span>활동비/장학금 우선</span>
          <input name="prefer_paid" type="checkbox" defaultChecked={settings.preferences.prefer_paid} />
        </label>

        <div className="full actions">
          <button className="button" type="submit">
            설정 저장
          </button>
        </div>
      </form>
    </>
  );
}
