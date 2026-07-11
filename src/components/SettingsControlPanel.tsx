"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITY_CATEGORIES, DEFAULT_SETTINGS, INTEREST_PRESETS } from "@/lib/defaults";
import type { AppSettings, CategoryMode, InterestLevel, ScheduleItem, Source } from "@/lib/types";
import type { CrawlRunView } from "@/lib/admin-data";
import { saveSettings, type SaveSettingsState } from "@/app/settings/actions";

type SourceView = Source & { stored_count: number };
type TabId = "profile" | "conditions" | "interests" | "schedule" | "sources" | "notification" | "scores" | "logs" | "advanced";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "profile", label: "기본 프로필" },
  { id: "conditions", label: "추천 조건" },
  { id: "interests", label: "관심 분야" },
  { id: "schedule", label: "일정 및 활동 시간" },
  { id: "sources", label: "수집처 관리" },
  { id: "notification", label: "알림 설정" },
  { id: "scores", label: "추천 점수" },
  { id: "logs", label: "수집 상태 및 로그" },
  { id: "advanced", label: "고급 설정" }
];

const LEVEL_LABELS: Record<InterestLevel, string> = {
  very_high: "매우 높음",
  high: "높음",
  normal: "보통",
  low: "낮음",
  exclude: "제외"
};

const CATEGORY_MODE_LABELS: Record<CategoryMode, string> = {
  include: "포함",
  low: "낮은 우선순위",
  exclude: "완전 제외"
};

const WEIGHT_LABELS: Record<string, string> = {
  major_match: "전공 적합도",
  interest_match: "관심 분야 적합도",
  location_match: "지역 및 이동 거리",
  schedule_match: "일정 적합도",
  benefit_match: "활동비 및 장학금",
  source_reliability: "출처 신뢰도"
};

const ADJUSTMENT_LABELS: Record<string, string> = {
  jnu_official: "전남대 공식 공지",
  mechanical_official: "기계공학부 공식 공지",
  international_official: "국제협력과 공지",
  gwangju_offline: "광주 오프라인",
  online: "온라인 활동",
  paid_benefit: "활동비 또는 장학금 있음",
  unknown_deadline: "마감일 미확인",
  unclear_target: "지원 대상 불명확",
  sns_core: "SNS 참여 중심",
  simple_event: "단순 경품·이벤트"
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "기록 없음";
  return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TagEditor({ values, suggestions = [], onChange, placeholder }: { values: string[]; suggestions?: readonly string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = (value: string) => {
    const normalized = value.trim();
    if (normalized && !values.includes(normalized)) onChange([...values, normalized]);
    setDraft("");
  };

  return (
    <div className="tag-editor">
      <div className="editable-tags">
        {values.map((value) => <span key={value}>{value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`${value} 삭제`}>×</button></span>)}
      </div>
      <div className="tag-add-row">
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(draft); } }} placeholder={placeholder} list={`${placeholder}-list`} />
        <datalist id={`${placeholder}-list`}>{suggestions.filter((item) => !values.includes(item)).map((item) => <option value={item} key={item} />)}</datalist>
        <button type="button" className="icon-text-button" onClick={() => add(draft)}>추가</button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}

export function SettingsControlPanel({ initialSettings, initialSources, runs, lastSavedAt }: { initialSettings: AppSettings; initialSources: SourceView[]; runs: CrawlRunView[]; lastSavedAt: string | null }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings, setSettings] = useState(() => clone(initialSettings));
  const [sources, setSources] = useState(() => clone(initialSources));
  const [advancedText, setAdvancedText] = useState(() => JSON.stringify(initialSettings.schedule, null, 2));
  const [advancedError, setAdvancedError] = useState("");
  const [sourceStatus, setSourceStatus] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useState("");
  const [newSourceOpen, setNewSourceOpen] = useState(false);
  const [actionState, formAction, pending] = useActionState<SaveSettingsState, FormData>(saveSettings, { ok: false, message: "", savedAt: null });
  const baseline = useRef(JSON.stringify({ settings: initialSettings, sources: initialSources }));
  const currentSerialized = useMemo(() => JSON.stringify({ settings, sources }), [settings, sources]);
  const changedSections = useMemo(() => {
    const original = JSON.parse(baseline.current) as { settings: AppSettings; sources: SourceView[] };
    return ["profile", "schedule", "preferences", "notification", "recommendation"].filter((key) => JSON.stringify(original.settings[key as keyof AppSettings]) !== JSON.stringify(settings[key as keyof AppSettings])).length
      + (JSON.stringify(original.sources) !== JSON.stringify(sources) ? 1 : 0)
      + (advancedText !== JSON.stringify(settings.schedule, null, 2) ? 1 : 0);
  }, [advancedText, settings, sources]);

  useEffect(() => {
    if (actionState.ok && actionState.savedAt) {
      baseline.current = currentSerialized;
      router.refresh();
    }
  }, [actionState.ok, actionState.savedAt, currentSerialized, router]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (changedSections > 0) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changedSections]);

  const updateSchedule = (next: AppSettings["schedule"]) => {
    setSettings((current) => ({ ...current, schedule: next }));
    setAdvancedText(JSON.stringify(next, null, 2));
    setAdvancedError("");
  };
  const resetChanges = () => {
    setSettings(clone(initialSettings));
    setSources(clone(initialSources));
    setAdvancedText(JSON.stringify(initialSettings.schedule, null, 2));
    setAdvancedError("");
  };
  const restoreDefaults = () => {
    setSettings(clone(DEFAULT_SETTINGS));
    setAdvancedText(JSON.stringify(DEFAULT_SETTINGS.schedule, null, 2));
  };
  const runSource = async (sourceId: string) => {
    setSourceStatus((current) => ({ ...current, [sourceId]: "수집 중" }));
    try {
      const response = await fetch(`/api/admin/sources/${encodeURIComponent(sourceId)}/scrape`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "수집 실패");
      const summary = payload.result?.sources?.find((item: { sourceId: string }) => item.sourceId === sourceId);
      setSourceStatus((current) => ({ ...current, [sourceId]: summary?.error ? `실패: ${summary.error}` : `완료: ${summary?.count ?? 0}건` }));
      router.refresh();
    } catch (error) {
      setSourceStatus((current) => ({ ...current, [sourceId]: error instanceof Error ? error.message : "수집 실패" }));
    }
  };
  const testNotification = async () => {
    setTestStatus("전송 중");
    try {
      const response = await fetch("/api/admin/test-notification", { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "전송 실패");
      setTestStatus(payload.message);
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : "전송 실패");
    }
  };

  const profile = settings.profile;
  const preferences = settings.preferences;
  const notification = settings.notification;
  const recommendation = settings.recommendation!;
  const weightTotal = Object.values(recommendation.weights).reduce((sum, value) => sum + value, 0);
  const groupedSources = Array.from(new Set(sources.map((source) => source.source_group ?? "직접 추가한 출처")));

  return (
    <form action={formAction} className="settings-console">
      <input type="hidden" name="settings_json" value={JSON.stringify(settings)} />
      <input type="hidden" name="sources_json" value={JSON.stringify(sources.map((source) => Object.fromEntries(Object.entries(source).filter(([key]) => key !== "stored_count"))))} />

      <div className="settings-top-actions">
        <div><span>{changedSections ? `저장되지 않은 변경사항 ${changedSections}개` : "모든 설정이 저장됨"}</span><small>마지막 저장 {formatDate(actionState.savedAt ?? lastSavedAt)}</small></div>
        <button type="button" className="button secondary" onClick={resetChanges} disabled={!changedSections}>변경 취소</button>
        <button type="submit" className="button" disabled={!changedSections || pending || Boolean(advancedError) || weightTotal !== 100}>{pending ? "저장 중" : "저장"}</button>
      </div>

      {actionState.message ? <div className={`settings-toast ${actionState.ok ? "success" : "error"}`}>{actionState.message}</div> : null}
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="설정 메뉴">
          {TABS.map((tab) => <button type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)} key={tab.id}>{tab.label}</button>)}
        </nav>

        <div className="settings-content">
          {activeTab === "profile" ? <section className="settings-section">
            <header><h2>기본 프로필</h2><p>추천 대상, 이동 범위와 진로 방향을 설정합니다.</p></header>
            <div className="control-grid">
              <label>학교<input value={profile.school} onChange={(event) => setSettings({ ...settings, profile: { ...profile, school: event.target.value } })} /></label>
              <label>단과대학<input value={profile.college ?? ""} onChange={(event) => setSettings({ ...settings, profile: { ...profile, college: event.target.value } })} /></label>
              <label>학과<input value={profile.department} onChange={(event) => setSettings({ ...settings, profile: { ...profile, department: event.target.value } })} /></label>
              <label>학년<select value={profile.grade ?? "2학년"} onChange={(event) => setSettings({ ...settings, profile: { ...profile, grade: event.target.value } })}>{["1학년", "2학년", "3학년", "4학년", "5학년 이상"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>재학 상태<select value={profile.enrollment_status ?? "재학생"} onChange={(event) => setSettings({ ...settings, profile: { ...profile, enrollment_status: event.target.value } })}>{["재학생", "휴학생", "졸업예정자"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>주 활동 지역<input value={profile.region} onChange={(event) => setSettings({ ...settings, profile: { ...profile, region: event.target.value } })} /></label>
              <label>최대 이동 시간<select value={profile.max_travel_minutes ?? 60} onChange={(event) => setSettings({ ...settings, profile: { ...profile, max_travel_minutes: Number(event.target.value) } })}>{[30, 60, 90, 120, 180].map((value) => <option value={value} key={value}>{value}분</option>)}</select></label>
              <label className="wide">이동 가능 지역<TagEditor values={profile.movable_regions ?? []} onChange={(values) => setSettings({ ...settings, profile: { ...profile, movable_regions: values } })} placeholder="지역 추가" /></label>
              <label className="wide">목표<textarea value={profile.target ?? ""} onChange={(event) => setSettings({ ...settings, profile: { ...profile, target: event.target.value } })} /></label>
              <label className="wide">희망 진로<input value={profile.desired_career ?? ""} onChange={(event) => setSettings({ ...settings, profile: { ...profile, desired_career: event.target.value } })} /></label>
              <label className="wide">관심 직무<TagEditor values={profile.desired_roles ?? []} onChange={(values) => setSettings({ ...settings, profile: { ...profile, desired_roles: values } })} placeholder="직무 추가" /></label>
            </div>
          </section> : null}

          {activeTab === "conditions" ? <section className="settings-section">
            <header><h2>추천 조건</h2><p>완전 제외는 추천과 알림에서 제거하고, 낮은 우선순위는 점수만 낮춥니다.</p></header>
            <div className="category-mode-list">{ACTIVITY_CATEGORIES.map((category) => <label key={category}><span>{category}</span><select value={preferences.category_modes?.[category] ?? "include"} onChange={(event) => setSettings({ ...settings, preferences: { ...preferences, category_modes: { ...preferences.category_modes, [category]: event.target.value as CategoryMode } } })}>{Object.entries(CATEGORY_MODE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}</div>
            <Toggle label="SNS 게시·팔로우·리그램이 핵심인 활동 완전 제외" checked={preferences.avoid_sns_core} onChange={(checked) => setSettings({ ...settings, preferences: { ...preferences, avoid_sns_core: checked } })} />
            <Toggle label="활동비·장학금·상금이 있는 공고 우선" checked={preferences.prefer_paid} onChange={(checked) => setSettings({ ...settings, preferences: { ...preferences, prefer_paid: checked } })} />
          </section> : null}

          {activeTab === "interests" ? <section className="settings-section">
            <header><h2>관심 분야와 키워드</h2><p>관심도는 추천 점수에 반영되고 제외 항목은 강하게 감점합니다.</p></header>
            <div className="interest-list">{(preferences.interest_keywords ?? []).map((item, index) => <div key={`${item.keyword}-${index}`}><span>{item.keyword}</span><select value={item.level} onChange={(event) => { const next = [...(preferences.interest_keywords ?? [])]; next[index] = { ...item, level: event.target.value as InterestLevel }; setSettings({ ...settings, preferences: { ...preferences, interest_keywords: next } }); }}>{Object.entries(LEVEL_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button type="button" aria-label={`${item.keyword} 삭제`} onClick={() => setSettings({ ...settings, preferences: { ...preferences, interest_keywords: (preferences.interest_keywords ?? []).filter((_, itemIndex) => itemIndex !== index) } })}>×</button></div>)}</div>
            <TagEditor values={[]} suggestions={INTEREST_PRESETS.filter((value) => !(preferences.interest_keywords ?? []).some((item) => item.keyword === value))} onChange={(values) => { const keyword = values[values.length - 1]; if (keyword) setSettings({ ...settings, preferences: { ...preferences, interest_keywords: [...(preferences.interest_keywords ?? []), { keyword, level: "normal" }] } }); }} placeholder="관심 분야 직접 추가" />
            <div className="keyword-groups">
              <label>우선 키워드<TagEditor values={preferences.priority_keywords} onChange={(values) => setSettings({ ...settings, preferences: { ...preferences, priority_keywords: values } })} placeholder="우선 키워드" /></label>
              <label>제외 키워드<TagEditor values={preferences.exclude_keywords} onChange={(values) => setSettings({ ...settings, preferences: { ...preferences, exclude_keywords: values } })} placeholder="제외 키워드" /></label>
              <label>검토 키워드<TagEditor values={preferences.review_keywords ?? []} onChange={(values) => setSettings({ ...settings, preferences: { ...preferences, review_keywords: values } })} placeholder="검토 키워드" /></label>
            </div>
          </section> : null}

          {activeTab === "schedule" ? <section className="settings-section">
            <header><h2>일정 및 활동 가능 시간</h2><p>정기 일정과 공고 활동 시간이 겹칠 때 적용할 기준입니다.</p></header>
            <div className="check-grid">{["온라인", "광주 오프라인", "전남 오프라인", "타 지역 오프라인"].map((mode) => <label key={mode}><input type="checkbox" checked={(settings.schedule.activity_modes ?? []).includes(mode)} onChange={(event) => updateSchedule({ ...settings.schedule, activity_modes: event.target.checked ? [...(settings.schedule.activity_modes ?? []), mode] : (settings.schedule.activity_modes ?? []).filter((item) => item !== mode) })} />{mode}</label>)}</div>
            <div className="control-grid compact"><label>평일 시작<input type="time" value={settings.schedule.weekday_start ?? "18:00"} onChange={(event) => updateSchedule({ ...settings.schedule, weekday_start: event.target.value })} /></label><label>평일 종료<input type="time" value={settings.schedule.weekday_end ?? "22:00"} onChange={(event) => updateSchedule({ ...settings.schedule, weekday_end: event.target.value })} /></label><label>일정 충돌 시<select value={settings.schedule.conflict_rule ?? "penalty"} onChange={(event) => updateSchedule({ ...settings.schedule, conflict_rule: event.target.value as "exclude" | "penalty" | "review" })}><option value="exclude">제외</option><option value="penalty">감점</option><option value="review">검토 필요</option></select></label><label>일정 미확인<select value={settings.schedule.unclear_schedule_rule ?? "review"} onChange={(event) => updateSchedule({ ...settings.schedule, unclear_schedule_rule: event.target.value as "exclude" | "review" | "allow" })}><option value="exclude">제외</option><option value="review">검토 필요</option><option value="allow">허용</option></select></label></div>
            <Toggle label="온라인 또는 일정 조정 가능 활동 가점" checked={settings.schedule.flexible_bonus ?? true} onChange={(checked) => updateSchedule({ ...settings.schedule, flexible_bonus: checked })} />
            <div className="schedule-list">{settings.schedule.unavailable_times.map((item, index) => <ScheduleEditor item={item} key={`${item.title}-${index}`} onChange={(next) => { const items = [...settings.schedule.unavailable_times]; items[index] = next; updateSchedule({ ...settings.schedule, unavailable_times: items }); }} onRemove={() => updateSchedule({ ...settings.schedule, unavailable_times: settings.schedule.unavailable_times.filter((_, itemIndex) => itemIndex !== index) })} />)}</div>
            <button type="button" className="button secondary" onClick={() => updateSchedule({ ...settings.schedule, unavailable_times: [...settings.schedule.unavailable_times, { title: "새 일정", days: ["월"], start_time: "18:00", end_time: "20:00", location: "광주", adjustable: true, active: true }] })}>일정 추가</button>
          </section> : null}

          {activeTab === "sources" ? <section className="settings-section">
            <header><h2>수집처 관리</h2><p>활성화된 실제 공식 페이지와 외부 사이트만 수집합니다.</p></header>
            {groupedSources.map((group) => <div className="source-group" key={group}><div className="source-group-head"><h3>{group}</h3><button type="button" className="text-button" onClick={() => { const groupSources = sources.filter((source) => (source.source_group ?? "직접 추가한 출처") === group); const enable = groupSources.some((source) => !source.enabled); setSources(sources.map((source) => (source.source_group ?? "직접 추가한 출처") === group ? { ...source, enabled: enable } : source)); }}>{sources.filter((source) => (source.source_group ?? "직접 추가한 출처") === group).every((source) => source.enabled) ? "그룹 끄기" : "그룹 켜기"}</button></div>{sources.filter((source) => (source.source_group ?? "직접 추가한 출처") === group).map((source) => <SourceCard source={source} status={sourceStatus[source.id]} key={source.id} onChange={(next) => setSources(sources.map((item) => item.id === next.id ? next : item))} onRun={() => runSource(source.id)} />)}</div>)}
            <button type="button" className="button secondary" onClick={() => setNewSourceOpen(!newSourceOpen)}>수집처 추가</button>
            {newSourceOpen ? <NewSourceForm onAdd={(source) => { setSources([...sources, source]); setNewSourceOpen(false); }} /> : null}
          </section> : null}

          {activeTab === "notification" ? <section className="settings-section">
            <header><h2>알림 설정</h2><p>현재 실제 연결된 채널은 카카오톡입니다. 나머지 채널은 준비 중입니다.</p></header>
            <Toggle label="알림 사용" checked={notification.enabled} onChange={(checked) => setSettings({ ...settings, notification: { ...notification, enabled: checked } })} />
            <div className="channel-row"><span className="channel active">카카오톡 · 사용 가능</span><span className="channel disabled">Telegram · 준비 중</span><span className="channel disabled">이메일 · 준비 중</span><span className="channel disabled">Discord · 준비 중</span></div>
            <div className="notification-time"><Toggle label="아침 알림" checked={notification.morning_enabled ?? true} onChange={(checked) => setSettings({ ...settings, notification: { ...notification, morning_enabled: checked } })} /><input type="time" value={notification.morning_time} onChange={(event) => setSettings({ ...settings, notification: { ...notification, morning_time: event.target.value } })} /><Toggle label="저녁 알림" checked={notification.evening_enabled ?? true} onChange={(checked) => setSettings({ ...settings, notification: { ...notification, evening_enabled: checked } })} /><input type="time" value={notification.evening_time} onChange={(event) => setSettings({ ...settings, notification: { ...notification, evening_time: event.target.value } })} /></div>
            <div className="control-grid compact"><label>마감 임박 기준<input type="number" min="1" max="30" value={preferences.deadline_soon_days} onChange={(event) => setSettings({ ...settings, preferences: { ...preferences, deadline_soon_days: Number(event.target.value) } })} /></label><label>최대 공고 수<input type="number" min="1" max="20" value={preferences.max_digest_items} onChange={(event) => setSettings({ ...settings, preferences: { ...preferences, max_digest_items: Number(event.target.value) } })} /></label><label>최소 추천 점수<input type="number" min="0" max="100" value={notification.minimum_score ?? 70} onChange={(event) => setSettings({ ...settings, notification: { ...notification, minimum_score: Number(event.target.value) } })} /></label></div>
            <Toggle label="검토 필요 공고도 알림에 포함" checked={notification.include_maybe ?? false} onChange={(checked) => setSettings({ ...settings, notification: { ...notification, include_maybe: checked } })} />
            <Toggle label="같은 공고 중복 발송 방지" checked={notification.prevent_duplicates ?? true} onChange={(checked) => setSettings({ ...settings, notification: { ...notification, prevent_duplicates: checked } })} />
            <div className="check-grid">{[["new_recommendation", "신규 추천 공고"], ["deadline_soon", "마감 임박 공고"], ["saved_schedule", "관심 공고 일정 알림"], ["collection_failure", "수집 실패 알림"], ["review_needed", "검토 필요 공고"]].map(([value, label]) => <label key={value}><input type="checkbox" checked={(notification.alert_types ?? []).includes(value)} onChange={(event) => setSettings({ ...settings, notification: { ...notification, alert_types: event.target.checked ? [...(notification.alert_types ?? []), value] : (notification.alert_types ?? []).filter((item) => item !== value) } })} />{label}</label>)}</div>
            <div className="inline-actions"><button type="button" className="button secondary" onClick={testNotification}>테스트 알림 보내기</button>{testStatus ? <span>{testStatus}</span> : null}</div>
          </section> : null}

          {activeTab === "scores" ? <section className="settings-section">
            <header><h2>추천 점수 설정</h2><p>가중치 합계는 정확히 100%여야 저장할 수 있습니다.</p></header>
            <div className="weight-total"><span>현재 합계</span><strong className={weightTotal === 100 ? "valid" : "invalid"}>{weightTotal}%</strong></div>
            <div className="score-list">{Object.entries(recommendation.weights).map(([key, value]) => <label key={key}><span>{WEIGHT_LABELS[key] ?? key}</span><input type="range" min="0" max="60" step="1" value={value} onChange={(event) => setSettings({ ...settings, recommendation: { ...recommendation, weights: { ...recommendation.weights, [key]: Number(event.target.value) } } })} /><input className="small-number" type="number" min="0" max="100" value={value} onChange={(event) => setSettings({ ...settings, recommendation: { ...recommendation, weights: { ...recommendation.weights, [key]: Number(event.target.value) } } })} /></label>)}</div>
            <label className="threshold-control">추천 상태 최소 점수<input type="number" min="0" max="100" value={recommendation.min_recommend_score} onChange={(event) => setSettings({ ...settings, recommendation: { ...recommendation, min_recommend_score: Number(event.target.value) } })} /></label>
            <h3>가감점</h3><div className="adjustment-grid">{Object.entries(recommendation.adjustments).map(([key, value]) => <label key={key}><span>{ADJUSTMENT_LABELS[key] ?? key}</span><input type="number" min="-100" max="100" value={value} onChange={(event) => setSettings({ ...settings, recommendation: { ...recommendation, adjustments: { ...recommendation.adjustments, [key]: Number(event.target.value) } } })} /></label>)}</div>
          </section> : null}

          {activeTab === "logs" ? <section className="settings-section">
            <header><h2>수집 상태 및 로그</h2><p>출처 하나가 실패해도 나머지 수집은 계속 실행됩니다.</p></header>
            <div className="log-table-wrap"><table className="log-table"><thead><tr><th>출처</th><th>시작</th><th>상태</th><th>수집</th><th>신규</th><th>중복</th><th>오류</th></tr></thead><tbody>{runs.length ? runs.map((run) => <tr key={run.id}><td>{sources.find((source) => source.id === run.source_id)?.name ?? run.source_id ?? "삭제된 출처"}</td><td>{formatDate(run.started_at)}</td><td><span className={`status-dot ${run.success ? "ok" : "fail"}`}>{run.success ? "정상" : "실패"}</span></td><td>{run.collected_count}</td><td>{run.new_count}</td><td>{run.duplicate_count}</td><td title={run.error_message ?? ""}>{run.error_message ?? "-"}</td></tr>) : <tr><td colSpan={7}>아직 출처별 실행 로그가 없습니다.</td></tr>}</tbody></table></div>
          </section> : null}

          {activeTab === "advanced" ? <section className="settings-section">
            <header><h2>고급 설정</h2><p>일반 일정 폼과 동기화됩니다. 잘못된 JSON은 저장할 수 없습니다.</p></header>
            <details><summary>유동 일정 JSON 편집</summary><textarea className="json-editor" value={advancedText} onChange={(event) => { const value = event.target.value; setAdvancedText(value); try { const parsed = JSON.parse(value) as AppSettings["schedule"]; if (parsed.mode !== "flexible" || !Array.isArray(parsed.unavailable_times)) throw new Error("mode와 unavailable_times가 필요합니다."); setSettings((current) => ({ ...current, schedule: parsed })); setAdvancedError(""); } catch (error) { setAdvancedError(error instanceof Error ? error.message : "JSON 오류"); } }} />{advancedError ? <p className="field-error">{advancedError}</p> : <p className="help-text">문법이 올바르며 일정 폼과 동기화되었습니다.</p>}</details>
            <div className="danger-zone"><div><strong>기본값 복원</strong><p>현재 편집 중인 값을 기본 프로필과 추천 조건으로 되돌립니다. 저장하기 전에는 DB에 반영되지 않습니다.</p></div><button type="button" className="button secondary" onClick={restoreDefaults}>기본값 불러오기</button></div>
          </section> : null}
        </div>
      </div>

      <div className="settings-save-bar"><div><strong>{changedSections ? `변경사항 ${changedSections}개` : "저장 완료"}</strong><span>{advancedError || (weightTotal !== 100 ? `가중치 합계 ${weightTotal}%` : "")}</span></div><button type="button" className="button secondary" onClick={resetChanges} disabled={!changedSections}>취소</button><button type="submit" className="button" disabled={!changedSections || pending || Boolean(advancedError) || weightTotal !== 100}>{pending ? "저장 중" : "설정 저장"}</button></div>
    </form>
  );
}

function ScheduleEditor({ item, onChange, onRemove }: { item: ScheduleItem; onChange: (item: ScheduleItem) => void; onRemove: () => void }) {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  return <article className="schedule-item"><div className="schedule-item-head"><input value={item.title} onChange={(event) => onChange({ ...item, title: event.target.value })} aria-label="일정 이름" /><button type="button" onClick={onRemove} aria-label="일정 삭제">×</button></div><div className="day-picker">{days.map((day) => <button type="button" className={item.days.includes(day) ? "active" : ""} onClick={() => onChange({ ...item, days: item.days.includes(day) ? item.days.filter((value) => value !== day) : [...item.days, day] })} key={day}>{day}</button>)}</div><div className="schedule-fields"><input type="time" value={item.start_time} onChange={(event) => onChange({ ...item, start_time: event.target.value })} aria-label="시작 시간" /><span>~</span><input type="time" value={item.end_time} onChange={(event) => onChange({ ...item, end_time: event.target.value })} aria-label="종료 시간" /><input value={item.location ?? ""} onChange={(event) => onChange({ ...item, location: event.target.value })} placeholder="장소" /><label><input type="checkbox" checked={item.adjustable} onChange={(event) => onChange({ ...item, adjustable: event.target.checked })} />조정 가능</label><label><input type="checkbox" checked={item.active} onChange={(event) => onChange({ ...item, active: event.target.checked })} />사용</label></div></article>;
}

function SourceCard({ source, status, onChange, onRun }: { source: SourceView; status?: string; onChange: (source: SourceView) => void; onRun: () => void }) {
  return <article className="source-card"><div className="source-card-head"><div><h4>{source.name}</h4><p>{source.source_type} · {source.organization}</p></div><Toggle label={source.enabled ? "활성" : "중지"} checked={source.enabled} onChange={(enabled) => onChange({ ...source, enabled })} /></div><div className="source-metrics"><span>상태 <b className={source.last_error ? "bad" : "good"}>{source.last_error ? "오류" : source.last_success_at ? "정상" : "미수집"}</b></span><span>마지막 성공 <b>{formatDate(source.last_success_at)}</b></span><span>최근 신규 <b>{source.last_new_count ?? 0}건</b></span><span>DB 저장 <b>{source.stored_count}건</b></span></div>{source.last_error ? <p className="source-error">{source.last_error}</p> : null}<details><summary>설정</summary><div className="control-grid compact"><label>출처명<input value={source.name} onChange={(event) => onChange({ ...source, name: event.target.value })} /></label><label>기관명<input value={source.organization ?? ""} onChange={(event) => onChange({ ...source, organization: event.target.value })} /></label><label className="wide">목록 URL<input type="url" value={source.url} onChange={(event) => onChange({ ...source, url: event.target.value, list_url: event.target.value })} /></label><label>그룹<input value={source.source_group ?? ""} onChange={(event) => onChange({ ...source, source_group: event.target.value })} /></label><label>우선순위<input type="number" min="1" max="10" value={source.priority ?? 5} onChange={(event) => onChange({ ...source, priority: Number(event.target.value) })} /></label><label>수집 주기(분)<input type="number" min="30" max="10080" value={source.crawl_interval_minutes ?? 360} onChange={(event) => onChange({ ...source, crawl_interval_minutes: Number(event.target.value) })} /></label></div></details><div className="inline-actions"><button type="button" className="button secondary" onClick={onRun} disabled={status === "수집 중"}>지금 수집</button>{status ? <span>{status}</span> : null}</div></article>;
}

function NewSourceForm({ onAdd }: { onAdd: (source: SourceView) => void }) {
  const [draft, setDraft] = useState({ name: "", organization: "", source_group: "직접 추가한 출처", url: "", source_type: "external" });
  return <div className="new-source-form"><h3>수집처 추가</h3><div className="control-grid"><label>출처명<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>기관명<input value={draft.organization} onChange={(event) => setDraft({ ...draft, organization: event.target.value })} /></label><label>출처 그룹<input value={draft.source_group} onChange={(event) => setDraft({ ...draft, source_group: event.target.value })} /></label><label>출처 유형<select value={draft.source_type} onChange={(event) => setDraft({ ...draft, source_type: event.target.value })}><option value="external">외부 사이트</option><option value="university">대학 공식</option><option value="department">학과 공식</option></select></label><label className="wide">목록 URL<input type="url" value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label></div><button type="button" className="button" disabled={!draft.name || !draft.organization || !/^https?:\/\//.test(draft.url)} onClick={() => onAdd({ id: `custom_${Date.now()}`, ...draft, base_url: new URL(draft.url).origin, list_url: draft.url, enabled: true, priority: 5, crawl_method: "registry_html", crawl_interval_minutes: 360, parser_config: {}, stored_count: 0 })}>추가</button></div>;
}
