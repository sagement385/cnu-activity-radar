import { ACTIVITY_CATEGORIES, DEFAULT_SETTINGS } from "./defaults";
import type { AppSettings, OpportunityRow, Recommendation, ScrapedOpportunity } from "./types";
import { daysUntil, isExpired } from "./date";
import { includesAny, matchKeywords } from "./text";

export const CATEGORIES = ACTIVITY_CATEGORIES;

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "인턴 및 현장실습", keywords: ["현장실습", "인턴십", "인턴", "채용연계", "실습학기제", "실습생"] },
  { category: "국제교류", keywords: ["교환학생", "해외 파견", "해외파견", "국제인턴", "어학연수", "글로벌 언어연수", "버디", "국제교류", "외국정부 초청"] },
  { category: "연구 및 학부연구생", keywords: ["학부연구생", "연구실", "랩실", "연구원 모집", "연구 프로그램"] },
  { category: "장학금 및 활동비", keywords: ["장학생", "장학금", "장학", "활동비", "지원금", "교통비", "수당", "상금"] },
  { category: "공모전", keywords: ["공모전", "아이디어", "해커톤", "경진대회", "콘테스트", "어워드"] },
  { category: "봉사활동", keywords: ["봉사활동", "해외 봉사", "교육봉사", "자원봉사"] },
  { category: "창업", keywords: ["창업", "예비창업", "스타트업", "메이커스페이스"] },
  { category: "취업 및 진로", keywords: ["취업", "멘토링", "채용설명회", "직무", "현직자", "진로", "기업탐방"] },
  { category: "교육 및 캠프", keywords: ["교육", "캠프", "스쿨", "아카데미", "부트캠프", "워크숍", "워크샵"] },
  { category: "행사 및 특강", keywords: ["특강", "세미나", "설명회", "포럼", "심포지엄", "행사"] },
  { category: "이벤트 및 경품", keywords: ["경품", "이벤트", "퀴즈", "리그램", "팔로우"] },
  { category: "학사 및 행정", keywords: ["수강신청", "시간표", "휴학", "복학", "등록금", "학사안내", "입학전형"] },
  { category: "교내 프로그램", keywords: ["전남대", "전남대학교", "비교과", "성장마루", "총장명예학생", "학생지원"] },
  { category: "대외활동", keywords: ["서포터즈", "홍보대사", "기자단", "모니터링단", "멘토단", "대외활동"] }
];

const SNS_KEYWORDS = ["sns", "인스타", "instagram", "릴스", "reels", "블로그", "유튜브", "콘텐츠 제작", "카드뉴스", "홍보 콘텐츠"];
const SNS_REQUIRED_KEYWORDS = ["sns 필수", "인스타그램 필수", "릴스 필수", "블로그 필수", "개인 sns", "개인 계정", "홍보 필수", "팔로워 인증", "리그램 필수"];
const PAID_KEYWORDS = ["활동비", "장학금", "지원금", "교통비", "식비", "수당", "실습비", "상금", "시상", "원고료"];
const MAJOR_KEYWORDS = ["기계", "기계공학", "공학", "공대", "제조", "생산", "자동차", "모빌리티", "로봇", "에너지", "ai", "데이터", "공정", "품질", "설계", "cad", "cae"];
const LOCATION_GOOD_KEYWORDS = ["광주", "전남", "온라인", "비대면", "전남대학교", "전남대"];
const WORK_STUDY_KEYWORDS = ["근로장학생", "국가근로", "대학근로", "근로 학생", "교내 근로"];
const INTERNSHIP_KEYWORDS = ["현장실습", "인턴", "채용연계", "실습학기제", "현장실습생", "인턴십", "실습생 모집"];
const ADMIN_NOTICE_KEYWORDS = ["시간표", "수강안내", "수강신청", "입학전형", "모집요강", "등록 공고", "강사 공개채용", "휴학", "복학", "졸업", "학사안내", "학위수여", "등록금", "학칙", "성적"];
const INELIGIBLE_TARGET_KEYWORDS = ["대학원생 전용", "대학원생만", "재직자 전용", "재직자만", "졸업생 전용", "졸업생만", "교원 대상", "교수 대상", "교직원 대상"];
const PASSIVE_EVENT_KEYWORDS = ["전시", "초대전", "특별전", "관람", "공연", "음악회", "단순 퀴즈", "구독 이벤트", "경품 이벤트"];
const CONCRETE_OUTCOME_KEYWORDS = ["수료증", "활동비", "장학금", "지원금", "프로젝트", "공모전", "경진대회", "해커톤", "서포터즈", "멘토링", "선발", "기수", "포트폴리오"];

export function classifyCategory(text: string, fallback = "기타") {
  for (const rule of CATEGORY_RULES) {
    if (includesAny(text, rule.keywords)) {
      return rule.category;
    }
  }
  return fallback;
}

function opportunityText(opportunity: OpportunityRow | ScrapedOpportunity) {
  const title = opportunity.title;
  const rawText = "raw_text" in opportunity ? opportunity.raw_text : opportunity.rawText;
  const sourceName = "source_name" in opportunity ? opportunity.source_name : opportunity.sourceName;
  const category = opportunity.category ?? classifyCategory(`${title} ${rawText}`);
  return { title, rawText, sourceName, category, text: `${title} ${sourceName} ${category} ${rawText}` };
}

export function hardExcludeReasons(opportunity: OpportunityRow | ScrapedOpportunity, settings: AppSettings) {
  const { text, category } = opportunityText(opportunity);
  const reasons: string[] = [];
  const categoryMode = settings.preferences.category_modes?.[category];

  if (includesAny(text, WORK_STUDY_KEYWORDS)) reasons.push("근로장학생·국가근로 계열은 제외");
  if (includesAny(text, INTERNSHIP_KEYWORDS) || category === "인턴 및 현장실습") reasons.push("인턴·현장실습 계열은 현재 조건에서 제외");
  if (includesAny(text, ADMIN_NOTICE_KEYWORDS) || category === "학사 및 행정") reasons.push("수강·입시·학사 등 행정성 공지는 제외");
  if (includesAny(text, INELIGIBLE_TARGET_KEYWORDS)) reasons.push("현재 재학생 지원 대상과 명확히 일치하지 않음");
  if (settings.preferences.avoid_sns_core && includesAny(text, SNS_REQUIRED_KEYWORDS)) reasons.push("개인 SNS 참여가 핵심 의무인 활동은 제외");
  if (includesAny(text, ["서울 정기", "수도권 정기", "서울에서 매주", "수도권 오프라인 필수"])) reasons.push("수도권 정기 오프라인 활동은 현재 이동 조건과 맞지 않음");
  if (opportunity.deadline && isExpired(opportunity.deadline)) reasons.push("이미 마감된 공고");
  if (categoryMode === "exclude" || settings.preferences.excluded_categories.includes(category)) reasons.push(`${category} 카테고리는 설정에서 완전 제외됨`);

  return Array.from(new Set(reasons));
}

export function scoreOpportunity(opportunity: OpportunityRow | ScrapedOpportunity, settings: AppSettings): Recommendation {
  const { title, sourceName, category, text } = opportunityText(opportunity);
  const sourceId = "source_id" in opportunity ? opportunity.source_id ?? "" : opportunity.sourceId;
  const deadline = opportunity.deadline;
  const recommendationSettings = settings.recommendation ?? DEFAULT_SETTINGS.recommendation!;
  const weights = recommendationSettings.weights;
  const adjustments = recommendationSettings.adjustments;
  const preferenceHits = matchKeywords(text, settings.preferences.priority_keywords);
  const excludeHits = matchKeywords(text, settings.preferences.exclude_keywords);
  const reviewHits = matchKeywords(text, settings.preferences.review_keywords ?? []);
  const activeInterests = (settings.preferences.interest_keywords ?? []).filter((item) => item.level !== "exclude");
  const excludedInterests = (settings.preferences.interest_keywords ?? []).filter((item) => item.level === "exclude").map((item) => item.keyword);
  const interestHits = activeInterests.filter((item) => includesAny(text, [item.keyword]));
  const isSnsRequired = includesAny(text, SNS_REQUIRED_KEYWORDS) || (settings.preferences.avoid_sns_core && includesAny(text, ["sns 활동", "sns 홍보", "릴스 제작", "개인 채널 운영"]));
  const hasSnsSignals = includesAny(text, SNS_KEYWORDS);
  const isPaid = includesAny(text, PAID_KEYWORDS);
  const isMajorRelevant = includesAny(text, MAJOR_KEYWORDS);
  const isUniversity = sourceId.startsWith("jnu_") || sourceName.includes("전남대") || sourceName.includes("전남대학교");
  const isDepartment = sourceId.includes("mech") || sourceName.includes("기계공학");
  const isInternational = sourceId.includes("international") || sourceName.includes("국제협력");
  const isGoodLocation = includesAny(text, LOCATION_GOOD_KEYWORDS);
  const isOnline = includesAny(text, ["온라인", "비대면", "원격"]);
  const scheduleConflict = inferScheduleConflict(text, settings);
  const hardReasons = hardExcludeReasons(opportunity, settings);
  const remainingDays = daysUntil(deadline);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const excludedReasons = [...hardReasons];

  const majorValue = isDepartment ? 100 : isMajorRelevant ? 90 : includesAny(text, ["공학", "공대", "이공계"]) ? 65 : 25;
  const interestWeight = interestHits.reduce((sum, item) => sum + ({ very_high: 5, high: 4, normal: 3, low: 1, exclude: 0 }[item.level] ?? 0), 0);
  const interestValue = Math.min(100, interestWeight * 15 + Math.min(preferenceHits.length * 8, 24) + (interestHits.length ? 20 : 0));
  const locationValue = isGoodLocation ? 100 : includesAny(text, ["서울", "수도권", "경기"]) ? 20 : 55;
  const scheduleValue = scheduleConflict === "none" ? 100 : scheduleConflict === "adjustable" ? 65 : scheduleConflict === "fixed" ? 15 : 50;
  const benefitValue = isPaid ? 100 : settings.preferences.prefer_paid ? 35 : 60;
  const sourceValue = isUniversity ? 100 : sourceId === "linkareer_activity" || sourceId === "allforyoung_activity" ? 70 : 55;
  const componentValues = {
    major_match: majorValue,
    interest_match: interestValue,
    location_match: locationValue,
    schedule_match: scheduleValue,
    benefit_match: benefitValue,
    source_reliability: sourceValue
  };
  const scoreBreakdown: Record<string, number> = {};
  let score = 0;

  for (const [key, value] of Object.entries(componentValues)) {
    const contribution = Math.round((value * weights[key as keyof typeof weights]) / 100);
    scoreBreakdown[key] = contribution;
    score += contribution;
  }

  const addAdjustment = (key: string, value: number) => {
    scoreBreakdown[key] = value;
    score += value;
  };

  if (isUniversity) {
    addAdjustment("jnu_official", adjustments.jnu_official);
    reasons.push("전남대학교 공식 출처에서 확인된 공고");
  }
  if (isDepartment) {
    addAdjustment("mechanical_official", adjustments.mechanical_official);
    reasons.push("기계공학부 공식 공지로 전공 연관성이 높음");
  } else if (isMajorRelevant) {
    reasons.push("기계·제조·모빌리티 관련 키워드와 일치");
  }
  if (isInternational) {
    addAdjustment("international_official", adjustments.international_official);
    reasons.push("국제협력 공식 공지로 해외 프로그램 관심과 연결됨");
  }
  if (isOnline) {
    addAdjustment("online", adjustments.online);
    reasons.push("온라인 참여가 가능해 현재 일정과 병행하기 쉬움");
  } else if (includesAny(text, ["광주", "전남대학교", "전남대"])) {
    addAdjustment("gwangju_offline", adjustments.gwangju_offline);
    reasons.push("광주권 활동으로 이동 조건에 맞음");
  }
  if (isPaid) {
    addAdjustment("paid_benefit", adjustments.paid_benefit);
    reasons.push("활동비·장학금·상금 등 혜택이 명시되거나 언급됨");
  }
  if (!deadline) {
    addAdjustment("unknown_deadline", adjustments.unknown_deadline);
    warnings.push("지원 마감일을 원문에서 확인해야 함");
  } else if (remainingDays !== null && remainingDays <= settings.preferences.deadline_soon_days) {
    warnings.push(`마감 임박 D-${Math.max(remainingDays, 0)}`);
  }
  if (!("requirements" in opportunity) || !opportunity.requirements) {
    addAdjustment("unclear_target", adjustments.unclear_target);
    warnings.push("지원 대상과 학년 조건은 원문 확인 필요");
  }
  if (isSnsRequired) addAdjustment("sns_core", adjustments.sns_core);
  else if (hasSnsSignals) warnings.push("SNS 또는 콘텐츠 제작 언급이 있어 활동 비중 확인 필요");
  if (includesAny(title, PASSIVE_EVENT_KEYWORDS) && !includesAny(text, CONCRETE_OUTCOME_KEYWORDS)) {
    addAdjustment("simple_event", adjustments.simple_event);
    warnings.push("단순 행사·이벤트 성격이 강해 결과물 여부 확인 필요");
  }
  if (excludeHits.length) {
    const penalty = Math.min(40, excludeHits.length * 12);
    addAdjustment("excluded_keywords", -penalty);
    warnings.push(`제외 키워드 감지: ${excludeHits.slice(0, 4).join(", ")}`);
  }
  if (matchKeywords(text, excludedInterests).length) {
    addAdjustment("excluded_interests", -30);
    excludedReasons.push("관심 분야에서 제외로 지정한 키워드가 포함됨");
  }
  if (settings.preferences.category_modes?.[category] === "low") {
    addAdjustment("low_priority_category", -15);
    warnings.push(`${category} 카테고리는 낮은 우선순위로 설정됨`);
  }
  if (interestHits.length) reasons.push(`관심 분야와 일치: ${interestHits.slice(0, 4).map((item) => item.keyword).join(", ")}`);
  else if (preferenceHits.length) reasons.push(`우선 키워드와 일치: ${preferenceHits.slice(0, 4).join(", ")}`);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const reviewRequired = reviewHits.length > 0 || (!deadline && settings.schedule.unclear_schedule_rule === "review");
  let status: Recommendation["status"] = score >= recommendationSettings.min_recommend_score ? "recommend" : score >= 45 ? "maybe" : "exclude";
  if (reviewRequired && status === "recommend") status = "maybe";
  if (hardReasons.length) {
    score = 0;
    status = "exclude";
  }
  if (reviewHits.length) warnings.push(`검토 키워드 감지: ${reviewHits.slice(0, 4).join(", ")}`);
  if (status === "exclude" && !excludedReasons.length) excludedReasons.push("설정된 추천 기준 점수에 미달함");
  scoreBreakdown.total_score = score;

  return {
    opportunity_id: "id" in opportunity ? opportunity.id : "",
    score,
    status,
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    warnings: Array.from(new Set(warnings)).slice(0, 4),
    excluded_reasons: Array.from(new Set(excludedReasons)).slice(0, 4),
    schedule_conflict: scheduleConflict,
    sns_required: isSnsRequired,
    is_paid: isPaid,
    is_major_relevant: isMajorRelevant,
    score_breakdown: scoreBreakdown
  };
}

export function inferScheduleConflict(text: string, settings: AppSettings): "none" | "adjustable" | "fixed" | "unknown" {
  const normalized = text.replace(/\s+/g, " ");
  if (includesAny(normalized, ["온라인", "비대면", "시간 조율", "시간협의", "자율", "원격"])) return "none";

  const activeItems = settings.schedule.unavailable_times.filter((item) => item.active);
  const mentionedSchedules = activeItems.filter((item) => item.days.some((day) => normalized.includes(`${day}요일`) || normalized.includes(`${day} `)));
  if (!mentionedSchedules.length) return "unknown";
  if (mentionedSchedules.some((item) => !item.adjustable)) return "fixed";
  return "adjustable";
}
