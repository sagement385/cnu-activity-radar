import type { AppSettings, OpportunityRow, Recommendation, ScrapedOpportunity } from "./types";
import { daysUntil, isExpired } from "./date";
import { includesAny, matchKeywords } from "./text";

const LOW_SIGNAL_TITLE_KEYWORDS = [
  "심포지엄",
  "세미나",
  "워크숍",
  "워크샵",
  "사례나눔회",
  "참관 안내",
  "마이크로 디그리",
  "연구방법론",
  "연구워크숍",
  "연구 워크숍",
  "영어 학습 코칭",
  "언어교육원",
  "재직자",
];

const CONCRETE_OUTCOME_KEYWORDS = [
  "수료증",
  "활동비",
  "장학금",
  "지원금",
  "프로젝트",
  "공모전",
  "경진대회",
  "해커톤",
  "서포터즈",
  "멘토링",
  "선발",
  "기수",
  "포트폴리오",
];

export const CATEGORIES = [
  "서포터즈",
  "공모전",
  "대외활동",
  "교내 프로그램",
  "장학·활동비",
  "교육·캠프",
  "취업·멘토링",
  "현장실습·인턴",
  "알바성 단기활동"
] as const;

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "현장실습·인턴", keywords: ["현장실습", "인턴", "채용연계", "실습학기제", "실습생"] },
  { category: "서포터즈", keywords: ["서포터즈", "홍보대사", "기자단", "모니터링단", "멘토단"] },
  { category: "공모전", keywords: ["공모전", "아이디어", "해커톤", "경진대회", "콘테스트"] },
  { category: "장학·활동비", keywords: ["장학", "장학금", "활동비", "지원금", "교통비", "수당", "상금"] },
  { category: "교육·캠프", keywords: ["교육", "캠프", "스쿨", "아카데미", "워크숍", "특강", "부트캠프"] },
  { category: "취업·멘토링", keywords: ["취업", "멘토링", "채용설명회", "직무설명회", "현직자", "진로"] },
  { category: "교내 프로그램", keywords: ["전남대", "전남대학교", "비교과", "성장마루", "총장명예학생", "학생지원"] },
  { category: "알바성 단기활동", keywords: ["스태프", "운영보조", "단기", "행사보조"] }
];

const SNS_KEYWORDS = ["sns", "인스타", "instagram", "릴스", "reels", "블로그", "유튜브", "콘텐츠 제작", "카드뉴스", "홍보 콘텐츠"];
const SNS_REQUIRED_KEYWORDS = ["sns 필수", "인스타그램 필수", "릴스 필수", "블로그 필수", "개인 sns", "개인 계정", "홍보 필수", "팔로워 인증"];
const PAID_KEYWORDS = ["활동비", "장학금", "지원금", "교통비", "식비", "수당", "실습비", "상금", "시상", "원고료"];
const MAJOR_KEYWORDS = ["기계", "기계공학", "공학", "공대", "제조", "생산", "자동차", "모빌리티", "로봇", "에너지", "ai", "데이터", "공정", "품질", "설계"];
const LARGE_OR_PUBLIC_KEYWORDS = ["삼성", "현대", "lg", "sk", "포스코", "한화", "롯데", "db", "kb", "신한", "공공기관", "한국", "공사", "공단", "진흥원", "광주광역시"];
const LOCATION_GOOD_KEYWORDS = ["광주", "전남", "온라인", "비대면", "전남대학교", "전남대"];
const SEOUL_REQUIRED_KEYWORDS = ["서울 오프라인", "수도권 오프라인", "서울 정기", "수도권 정기", "서울에서 매주"];
const WORK_STUDY_KEYWORDS = ["근로장학생", "국가근로", "대학근로", "근로 학생", "교내 근로"];
const INTERNSHIP_KEYWORDS = ["현장실습", "인턴", "채용연계", "실습학기제", "현장실습생", "인턴십", "실습생 모집"];
const ADMIN_NOTICE_KEYWORDS = [
  "시간표",
  "수강안내",
  "수강신청",
  "입학전형",
  "모집요강",
  "등록 공고",
  "강사 공개채용",
  "휴학",
  "복학",
  "졸업",
  "학사안내",
  "학위수여",
  "등록금",
  "등록 안내",
  "학칙",
  "성적",
  "학석사",
  "학석박사",
  "연계과정",
  "대학원",
  "대학원생",
  "연구생",
  "신입사원",
  "채용 공고",
  "채용 안내",
  "교육과정"
];
const SPEC_VALUE_KEYWORDS = [
  "서포터즈",
  "공모전",
  "기수",
  "선발",
  "수료증",
  "활동증명서",
  "포트폴리오",
  "프로젝트",
  "해커톤",
  "경진대회",
  "멘토링",
  "리더십",
  "대외활동",
  "활동비",
  "장학금",
  "상금",
  "심포지엄",
  "세미나"
];
const PASSIVE_EVENT_KEYWORDS = ["전시", "초대전", "특별전", "관람", "공연", "음악회", "작품", "사회적 대화", "연구워크숍"];

export function classifyCategory(text: string, fallback = "대외활동") {
  for (const rule of CATEGORY_RULES) {
    if (includesAny(text, rule.keywords)) {
      return rule.category;
    }
  }

  return fallback;
}

export function hardExcludeReasons(opportunity: OpportunityRow | ScrapedOpportunity, settings: AppSettings) {
  const title = "title" in opportunity ? opportunity.title : "";
  const rawText = "raw_text" in opportunity ? opportunity.raw_text : opportunity.rawText;
  const sourceName = "source_name" in opportunity ? opportunity.source_name : opportunity.sourceName;
  const category = "category" in opportunity ? opportunity.category ?? classifyCategory(`${title} ${rawText}`) : opportunity.category ?? classifyCategory(`${title} ${rawText}`);
  const text = `${title} ${sourceName} ${category} ${rawText}`;
  const reasons: string[] = [];

  if (includesAny(text, WORK_STUDY_KEYWORDS)) {
    reasons.push("근로장학생/국가근로 계열은 제외");
  }

  if (includesAny(text, INTERNSHIP_KEYWORDS) || category === "현장실습·인턴") {
    reasons.push("현장실습·인턴 계열은 현재 조건에서 제외");
  }

  if (includesAny(text, ADMIN_NOTICE_KEYWORDS)) {
    reasons.push("시간표·수강·입시·학사 등 행정성 공지는 제외");
  }

  const hasLowSignalTitle = includesAny(title, LOW_SIGNAL_TITLE_KEYWORDS);
  const hasConcreteOutcome = includesAny(text, CONCRETE_OUTCOME_KEYWORDS);
  if (hasLowSignalTitle && !hasConcreteOutcome) {
    reasons.push("일반 행사·강연 중심이고 스펙으로 남는 결과가 확인되지 않음");
  }

  if (includesAny(text, SEOUL_REQUIRED_KEYWORDS)) {
    reasons.push("수도권 정기 오프라인 활동은 현재 일정과 맞지 않아 제외");
  }

  if (opportunity.deadline && isExpired(opportunity.deadline)) {
    reasons.push("이미 마감된 공고");
  }

  if (settings.preferences.excluded_categories?.includes(category)) {
    reasons.push(`${category} 카테고리는 설정에서 제외됨`);
  }

  return reasons;
}

export function scoreOpportunity(opportunity: OpportunityRow | ScrapedOpportunity, settings: AppSettings): Recommendation {
  const title = "title" in opportunity ? opportunity.title : "";
  const rawText = "raw_text" in opportunity ? opportunity.raw_text : opportunity.rawText;
  const sourceName = "source_name" in opportunity ? opportunity.source_name : opportunity.sourceName;
  const sourceId = "source_id" in opportunity ? opportunity.source_id ?? "" : opportunity.sourceId;
  const category = "category" in opportunity ? opportunity.category ?? "대외활동" : opportunity.category ?? classifyCategory(`${title} ${rawText}`);
  const deadline = opportunity.deadline;
  const text = `${title} ${sourceName} ${category} ${rawText}`;

  let score = 50;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const excludedReasons: string[] = [];
  const preferenceHits = matchKeywords(text, settings.preferences.priority_keywords);
  const excludeHits = matchKeywords(text, settings.preferences.exclude_keywords);
  const isSnsRequired = includesAny(text, SNS_REQUIRED_KEYWORDS) || (settings.preferences.avoid_sns_core && includesAny(text, ["sns 활동", "sns 홍보", "릴스 제작", "개인 채널 운영"]));
  const hasSnsSignals = includesAny(text, SNS_KEYWORDS);
  const isPaid = includesAny(text, PAID_KEYWORDS);
  const isMajorRelevant = includesAny(text, MAJOR_KEYWORDS);
  const isLargeOrPublic = includesAny(text, LARGE_OR_PUBLIC_KEYWORDS);
  const isGoodLocation = includesAny(text, LOCATION_GOOD_KEYWORDS);
  const hasSpecValue = includesAny(text, SPEC_VALUE_KEYWORDS);
  const hasConcreteOutcome = includesAny(text, CONCRETE_OUTCOME_KEYWORDS);
  const isPassiveEvent = includesAny(text, PASSIVE_EVENT_KEYWORDS);
  const isUniversity = sourceId?.includes("jnu") || sourceName.includes("전남대") || sourceName.includes("전남대학교");
  const isDepartment = sourceId?.includes("mech") || sourceName.includes("기계공학");
  const remainingDays = daysUntil(deadline);

  if (isUniversity) {
    score += 15;
    reasons.push("전남대 공식 공지라 확인 우선순위가 높음");
  }
  if (isDepartment) {
    score += 25;
    reasons.push("기계공학과/학부 공지라 전공 관련성이 높음");
  }
  if (isMajorRelevant) {
    score += 15;
    reasons.push("기계공학·공대생에게 연결할 만한 키워드가 있음");
  }
  if (isLargeOrPublic) {
    score += 15;
    reasons.push("대기업 또는 공공기관 성격의 활동으로 스펙 활용도가 있음");
  }
  if (isPaid) {
    score += 12;
    reasons.push("활동비·장학금·상금 등 금전적 혜택 가능성이 있음");
  }
  if (isGoodLocation) {
    score += 15;
    reasons.push("광주/전남/온라인 중심이라 병행 가능성이 높음");
  }
  if (includesAny(text, ["기수", "수료증", "활동증명서", "이수증", "포트폴리오"])) {
    score += 10;
    reasons.push("기수제·수료 기록으로 포트폴리오에 정리하기 좋음");
  }
  if (!hasSpecValue && isPassiveEvent) {
    score -= 35;
    warnings.push("관람·전시 성격이 강해 스펙 활용도는 낮을 수 있음");
  }
  if (includesAny(title, LOW_SIGNAL_TITLE_KEYWORDS) && !hasConcreteOutcome) {
    score -= 25;
    warnings.push("일반 행사형 공고라 수료증·활동비·프로젝트 여부를 확인할 필요가 있음");
  }

  if (preferenceHits.length > 0) {
    score += Math.min(preferenceHits.length * 3, 12);
    reasons.push(`우선 키워드와 일치: ${preferenceHits.slice(0, 4).join(", ")}`);
  }
  if (excludeHits.length > 0) {
    score -= Math.min(excludeHits.length * 18, 60);
    warnings.push(`제외 키워드 감지: ${excludeHits.slice(0, 4).join(", ")}`);
  }
  if (isSnsRequired) {
    score -= 45;
    excludedReasons.push("SNS 홍보 또는 개인 SNS 활동이 핵심일 가능성이 큼");
  } else if (hasSnsSignals) {
    score -= 12;
    warnings.push("SNS/콘텐츠 제작 언급이 있어 세부 조건 확인 필요");
  }

  const hardReasons = hardExcludeReasons(opportunity, settings);
  if (hardReasons.length) {
    score -= hardReasons.length * 100;
    excludedReasons.push(...hardReasons);
  }

  if (deadline && !isExpired(deadline) && remainingDays !== null && remainingDays <= settings.preferences.deadline_soon_days) {
    score += 5;
    warnings.push(`마감 임박 D-${Math.max(remainingDays, 0)}`);
  }

  const scheduleConflict = inferScheduleConflict(text, settings);
  if (scheduleConflict === "none") {
    score += 8;
  } else if (scheduleConflict === "adjustable") {
    score -= 8;
    warnings.push("조정 가능한 일정과 일부 겹칠 수 있음");
  } else if (scheduleConflict === "fixed") {
    score -= 25;
    warnings.push("현재 일정과 충돌 가능성이 높음");
  } else {
    score -= 4;
    warnings.push("활동 시간이 명확하지 않아 확인 필요");
  }

  if (settings.preferences.include_categories.length && !settings.preferences.include_categories.includes(category)) {
    score -= 35;
    excludedReasons.push(`${category} 카테고리는 현재 포함 목록 밖임`);
  }

  const status = score >= 70 ? "recommend" : score >= 45 ? "maybe" : "exclude";
  if (status === "exclude" && excludedReasons.length === 0) {
    excludedReasons.push("추천 점수가 낮아 맞춤 후보에서 제외");
  }

  return {
    opportunity_id: "id" in opportunity ? opportunity.id : "",
    score,
    status,
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 4),
    excluded_reasons: Array.from(new Set(excludedReasons)).slice(0, 4),
    schedule_conflict: scheduleConflict,
    sns_required: isSnsRequired,
    is_paid: isPaid,
    is_major_relevant: isMajorRelevant
  };
}

function inferScheduleConflict(text: string, settings: AppSettings): "none" | "adjustable" | "fixed" | "unknown" {
  const normalized = text.replace(/\s+/g, " ");

  if (includesAny(normalized, ["온라인", "비대면", "시간 조율", "시간협의", "자율", "원격"])) {
    return "none";
  }

  const activeItems = settings.schedule.unavailable_times.filter((item) => item.active);
  const mentionedSchedules = activeItems.filter((item) => item.days.some((day) => normalized.includes(day)));

  if (!mentionedSchedules.length) {
    return "unknown";
  }

  if (mentionedSchedules.some((item) => !item.adjustable)) {
    return "fixed";
  }

  return "adjustable";
}
