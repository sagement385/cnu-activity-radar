import type { AppSettings, OpportunityRow, Recommendation, ScrapedOpportunity } from "./types";
import { daysUntil, isExpired } from "./date";
import { includesAny, matchKeywords } from "./text";

const CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "서포터즈", keywords: ["서포터즈", "홍보대사", "기자단", "모니터링단", "멘토단"] },
  { category: "공모전", keywords: ["공모전", "아이디어", "해커톤", "경진대회", "대회", "콘테스트"] },
  { category: "현장실습·인턴", keywords: ["현장실습", "인턴", "채용연계", "실습학기제"] },
  { category: "장학·활동비", keywords: ["장학", "장학금", "활동비", "지원금", "교통비", "수당"] },
  { category: "교육·캠프", keywords: ["교육", "캠프", "스쿨", "아카데미", "워크숍", "특강", "부트캠프"] },
  { category: "교내 프로그램", keywords: ["전남대", "전남대학교", "비교과", "성장마루", "총장명예학생"] },
  { category: "알바성 단기활동", keywords: ["스태프", "운영보조", "단기", "행사보조"] }
];

const SNS_KEYWORDS = ["sns", "인스타", "instagram", "릴스", "reels", "블로그", "유튜브", "콘텐츠 제작", "카드뉴스", "홍보 콘텐츠"];
const SNS_REQUIRED_KEYWORDS = ["sns 필수", "인스타그램 필수", "릴스 필수", "블로그 필수", "개인 sns", "개인 계정", "홍보 필수"];
const PAID_KEYWORDS = ["활동비", "장학금", "지원금", "교통비", "식비", "수당", "실습비", "상금", "시상"];
const MAJOR_KEYWORDS = ["기계", "기계공학", "공학", "공대", "제조", "생산", "자동차", "모빌리티", "로봇", "에너지", "ai", "데이터", "공정", "품질"];
const LARGE_OR_PUBLIC_KEYWORDS = ["삼성", "현대", "lg", "sk", "포스코", "한화", "롯데", "db", "kb", "신한", "공공기관", "한국", "공사", "공단", "진흥원", "광주광역시"];
const LOCATION_GOOD_KEYWORDS = ["광주", "전남", "온라인", "비대면", "전남대학교", "전남대"];
const SEOUL_REQUIRED_KEYWORDS = ["서울 오프라인", "수도권 오프라인", "서울 정기", "수도권 정기"];
const WORK_STUDY_KEYWORDS = ["근로장학생", "국가근로", "대학근로", "근로 학생"];

export function classifyCategory(text: string, fallback = "대외활동") {
  for (const rule of CATEGORY_RULES) {
    if (includesAny(text, rule.keywords)) {
      return rule.category;
    }
  }

  return fallback;
}

export function scoreOpportunity(opportunity: OpportunityRow | ScrapedOpportunity, settings: AppSettings): Recommendation {
  const title = "title" in opportunity ? opportunity.title : "";
  const rawText = "raw_text" in opportunity ? opportunity.raw_text : opportunity.rawText;
  const sourceName = "source_name" in opportunity ? opportunity.source_name : opportunity.sourceName;
  const sourceId = "source_id" in opportunity ? opportunity.source_id ?? "" : opportunity.sourceId;
  const category = "category" in opportunity ? opportunity.category ?? "대외활동" : opportunity.category ?? classifyCategory(`${title} ${rawText}`);
  const deadline = "deadline" in opportunity ? opportunity.deadline : opportunity.deadline;
  const text = `${title} ${sourceName} ${category} ${rawText}`;

  let score = 50;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const excludedReasons: string[] = [];

  const preferenceHits = matchKeywords(text, settings.preferences.priority_keywords);
  const excludeHits = matchKeywords(text, settings.preferences.exclude_keywords);
  const isSnsRequired = includesAny(text, SNS_REQUIRED_KEYWORDS) || (settings.preferences.avoid_sns_core && includesAny(text, ["sns 활동", "sns 홍보", "릴스 제작"]));
  const hasSnsSignals = includesAny(text, SNS_KEYWORDS);
  const isPaid = includesAny(text, PAID_KEYWORDS);
  const isMajorRelevant = includesAny(text, MAJOR_KEYWORDS);
  const isLargeOrPublic = includesAny(text, LARGE_OR_PUBLIC_KEYWORDS);
  const isGoodLocation = includesAny(text, LOCATION_GOOD_KEYWORDS);
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

  if (includesAny(text, ["기수", "수료증", "활동증명서", "이수증"])) {
    score += 10;
    reasons.push("기수제 또는 수료 기록으로 정리하기 좋음");
  }

  if (preferenceHits.length > 0) {
    score += Math.min(preferenceHits.length * 3, 12);
    reasons.push(`우선 키워드와 일치: ${preferenceHits.slice(0, 4).join(", ")}`);
  }

  if (excludeHits.length > 0) {
    score -= Math.min(excludeHits.length * 15, 45);
    warnings.push(`제외 키워드 감지: ${excludeHits.slice(0, 4).join(", ")}`);
  }

  if (isSnsRequired) {
    score -= 35;
    excludedReasons.push("SNS 홍보 또는 개인 SNS 활동이 핵심일 가능성이 큼");
  } else if (hasSnsSignals) {
    score -= 12;
    warnings.push("SNS/콘텐츠 제작 언급이 있어 세부 조건 확인 필요");
  }

  if (includesAny(text, WORK_STUDY_KEYWORDS)) {
    score -= 100;
    excludedReasons.push("근로장학생/국가근로 계열은 제외 조건에 해당");
  }

  if (includesAny(text, SEOUL_REQUIRED_KEYWORDS)) {
    score -= 30;
    excludedReasons.push("수도권 정기 오프라인 가능성이 있어 현재 조건과 맞지 않음");
  }

  if (deadline && isExpired(deadline)) {
    score -= 100;
    excludedReasons.push("이미 마감된 공고");
  } else if (remainingDays !== null && remainingDays <= settings.preferences.deadline_soon_days) {
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

  const status = score >= 70 ? "recommend" : score >= 45 ? "maybe" : "exclude";

  if (status === "exclude" && excludedReasons.length === 0) {
    excludedReasons.push("추천 점수가 낮아 카톡 발송 대상에서 제외");
  }

  return {
    opportunity_id: "id" in opportunity ? opportunity.id : "",
    score,
    status,
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 4),
    excluded_reasons: excludedReasons.slice(0, 4),
    schedule_conflict: scheduleConflict,
    sns_required: isSnsRequired,
    is_paid: isPaid,
    is_major_relevant: isMajorRelevant
  };
}

function inferScheduleConflict(text: string, settings: AppSettings): "none" | "adjustable" | "fixed" | "unknown" {
  const normalized = text.replace(/\s+/g, " ");

  if (includesAny(normalized, ["온라인", "비대면", "시간 조율", "시간협의", "자율"])) {
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
