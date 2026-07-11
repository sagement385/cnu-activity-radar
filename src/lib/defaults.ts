import type { AppSettings, CategoryMode, Source } from "./types";

export const ACTIVITY_CATEGORIES = [
  "공모전",
  "대외활동",
  "교내 프로그램",
  "국제교류",
  "장학금 및 활동비",
  "교육 및 캠프",
  "취업 및 진로",
  "인턴 및 현장실습",
  "봉사활동",
  "창업",
  "연구 및 학부연구생",
  "행사 및 특강",
  "학사 및 행정",
  "이벤트 및 경품",
  "기타"
] as const;

export const INTEREST_PRESETS = [
  "기계공학", "로봇", "자동화", "제어", "스마트팩토리", "제조", "생산기술", "모빌리티", "자율주행",
  "배터리", "에너지", "RE100", "열유체", "설계", "CAD", "CAE", "MATLAB", "AI", "피지컬 AI",
  "데이터 분석", "디지털 트윈", "창업", "국제 인턴십", "교환학생", "영어", "취업", "공기업"
] as const;

const DEFAULT_CATEGORY_MODES = Object.fromEntries(
  ACTIVITY_CATEGORIES.map((category) => [category, category === "인턴 및 현장실습" ? "exclude" : category === "이벤트 및 경품" ? "low" : "include"])
) as Record<string, CategoryMode>;

export const DEFAULT_SETTINGS: AppSettings = {
  id: "default",
  profile: {
    school: "전남대학교",
    college: "공과대학",
    department: "기계공학부",
    grade: "2학년",
    enrollment_status: "재학생",
    region: "광주",
    movable_regions: ["광주", "전남", "온라인"],
    max_travel_minutes: 60,
    target: "스펙에 도움되는 교내외 활동을 놓치지 않기",
    desired_career: "기계공학 기반 제조·모빌리티 분야",
    desired_roles: ["생산기술", "설계", "자동화"]
  },
  schedule: {
    mode: "flexible",
    activity_modes: ["온라인", "광주 오프라인", "전남 오프라인"],
    weekday_start: "18:00",
    weekday_end: "22:00",
    weekend_days: ["토", "일"],
    conflict_rule: "penalty",
    unclear_schedule_rule: "review",
    flexible_bonus: true,
    unavailable_times: [
      {
        title: "전주 알바",
        days: ["금", "토", "일"],
        start_time: "09:00",
        end_time: "15:00",
        location: "전주",
        adjustable: true,
        active: true
      },
      {
        title: "센터 알바",
        days: ["화", "목"],
        start_time: "17:00",
        end_time: "19:00",
        location: "광주",
        adjustable: true,
        active: true
      }
    ],
    rules: {
      unclear_schedule: "검토 필요",
      fixed_conflict: "감점",
      adjustable_conflict: "약한 감점",
      online_or_flexible: "가점"
    }
  },
  preferences: {
    include_categories: ACTIVITY_CATEGORIES.filter((category) => !["인턴 및 현장실습", "학사 및 행정"].includes(category)),
    excluded_categories: ["인턴 및 현장실습", "학사 및 행정"],
    category_modes: DEFAULT_CATEGORY_MODES,
    interest_keywords: [
      { keyword: "기계공학", level: "very_high" },
      { keyword: "로봇", level: "very_high" },
      { keyword: "모빌리티", level: "high" },
      { keyword: "제조", level: "high" },
      { keyword: "배터리", level: "normal" },
      { keyword: "SNS 활동", level: "exclude" }
    ],
    exclude_keywords: ["근로장학생", "국가근로", "대학근로", "현장실습", "인턴", "채용연계", "실습학기제", "실습생", "SNS 필수", "인스타 필수", "릴스 필수", "블로그 필수", "유튜브 홍보", "수도권 정기", "서울 정기"],
    priority_keywords: ["기계공학", "공학", "공대", "제조", "모빌리티", "자동차", "로봇", "AI", "에너지", "공공기관", "대기업", "활동비", "장학금", "수료증", "기수", "서포터즈"],
    review_keywords: ["대학원생", "재직자", "졸업생", "유료", "대상 확인"],
    avoid_sns_core: true,
    prefer_paid: true,
    deadline_soon_days: 5,
    max_digest_items: 5
  },
  notification: {
    channel: "kakao",
    morning_time: "08:00",
    evening_time: "21:00",
    enabled: true,
    morning_enabled: true,
    evening_enabled: true,
    minimum_score: 70,
    include_maybe: false,
    prevent_duplicates: true,
    alert_types: ["new_recommendation", "deadline_soon", "collection_failure"]
  },
  recommendation: {
    weights: {
      major_match: 30,
      interest_match: 25,
      location_match: 15,
      schedule_match: 15,
      benefit_match: 10,
      source_reliability: 5
    },
    adjustments: {
      jnu_official: 15,
      mechanical_official: 20,
      international_official: 10,
      gwangju_offline: 10,
      online: 8,
      paid_benefit: 10,
      unknown_deadline: -10,
      unclear_target: -10,
      sns_core: -25,
      simple_event: -30
    },
    min_recommend_score: 70
  }
};

export const DEFAULT_SOURCES: Source[] = [
  {
    id: "jnu_events",
    name: "전남대 행사/비교과",
    url: "https://events.jnu.ac.kr/Search.aspx?mode=text&query=",
    base_url: "https://events.jnu.ac.kr",
    list_url: "https://events.jnu.ac.kr/Search.aspx?mode=text&query=",
    organization: "전남대학교",
    source_group: "전남대학교 대표",
    source_type: "university",
    enabled: true,
    priority: 10,
    crawl_method: "jnu_events",
    crawl_interval_minutes: 360
  },
  {
    id: "jnu_main_notice",
    name: "전남대 대표 공지",
    url: "https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5",
    base_url: "https://www.jnu.ac.kr",
    list_url: "https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5",
    organization: "전남대학교",
    source_group: "전남대학교 대표",
    source_type: "university",
    enabled: true,
    priority: 9,
    crawl_method: "jnu_board",
    crawl_interval_minutes: 360
  },
  {
    id: "jnu_international_notice",
    name: "전남대 국제협력과 공지",
    url: "https://international.jnu.ac.kr/Board/Notice.aspx",
    base_url: "https://international.jnu.ac.kr",
    list_url: "https://international.jnu.ac.kr/Board/Notice.aspx",
    organization: "전남대학교 국제협력과",
    source_group: "국제협력",
    source_type: "international",
    enabled: true,
    priority: 10,
    crawl_method: "registry_html",
    crawl_interval_minutes: 360,
    parser_config: { link_pattern: "/Board/Board\\.aspx\\?BoardID=.*Mode=View", limit: 24, detail_limit: 12 }
  },
  {
    id: "jnu_jobcenter_notice",
    name: "전남대 대학일자리플러스센터",
    url: "https://jobcenter.jnu.ac.kr/?mid=0104",
    base_url: "https://jobcenter.jnu.ac.kr",
    list_url: "https://jobcenter.jnu.ac.kr/?mid=0104",
    organization: "전남대학교 대학일자리플러스센터",
    source_group: "취업 및 진로",
    source_type: "career",
    enabled: true,
    priority: 8,
    crawl_method: "registry_html",
    crawl_interval_minutes: 360,
    parser_config: { link_pattern: "act=dtl.*mid=0104|mid=0104.*act=dtl", limit: 24, detail_limit: 12 }
  },
  {
    id: "jnu_education_innovation",
    name: "전남대 교육혁신본부",
    url: "https://ile.jnu.ac.kr/ko/community/notice",
    base_url: "https://ile.jnu.ac.kr",
    list_url: "https://ile.jnu.ac.kr/ko/community/notice",
    organization: "전남대학교 교육혁신본부",
    source_group: "비교과 및 교육",
    source_type: "education",
    enabled: true,
    priority: 8,
    crawl_method: "registry_html",
    crawl_interval_minutes: 360,
    parser_config: { link_pattern: "/ko/community/notice/(?:view/)?[0-9]+", limit: 24, detail_limit: 12 }
  },
  {
    id: "jnu_engineering_notice",
    name: "전남대 공과대학 공지",
    url: "https://eng.jnu.ac.kr/eng/7343/subview.do",
    base_url: "https://eng.jnu.ac.kr",
    list_url: "https://eng.jnu.ac.kr/eng/7343/subview.do",
    organization: "전남대학교 공과대학",
    source_group: "공과대학",
    source_type: "engineering",
    enabled: true,
    priority: 10,
    crawl_method: "registry_html",
    crawl_interval_minutes: 360,
    parser_config: { link_pattern: "artclView\\.do", limit: 24, detail_limit: 12 }
  },
  {
    id: "jnu_mech_notice",
    name: "전남대 기계공학부 공지",
    url: "https://mech.jnu.ac.kr/mech/8218/subview.do",
    base_url: "https://mech.jnu.ac.kr",
    list_url: "https://mech.jnu.ac.kr/mech/8218/subview.do",
    organization: "전남대학교 기계공학부",
    source_group: "기계공학부",
    source_type: "department",
    enabled: true,
    priority: 10,
    crawl_method: "jnu_board",
    crawl_interval_minutes: 360
  },
  {
    id: "linkareer_activity",
    name: "링커리어 대외활동",
    url: "https://linkareer.com/list/activity",
    base_url: "https://linkareer.com",
    list_url: "https://linkareer.com/list/activity",
    organization: "링커리어",
    source_group: "외부 대외활동 사이트",
    source_type: "external",
    enabled: true,
    priority: 6,
    crawl_method: "linkareer",
    crawl_interval_minutes: 720
  },
  {
    id: "allforyoung_activity",
    name: "올포영 대외활동/공모전",
    url: "https://www.allforyoung.com/posts/contest",
    base_url: "https://www.allforyoung.com",
    list_url: "https://www.allforyoung.com/posts/contest",
    organization: "올포영",
    source_group: "공모전 사이트",
    source_type: "external",
    enabled: true,
    priority: 6,
    crawl_method: "allforyoung",
    crawl_interval_minutes: 720
  },
  {
    id: "thinkcontest_activity",
    name: "씽굿 공모전/대외활동",
    url: "https://www.thinkcontest.com/Contest/CateField.html?c=1",
    base_url: "https://www.thinkcontest.com",
    list_url: "https://www.thinkcontest.com/Contest/CateField.html?c=1",
    organization: "씽굿",
    source_group: "공모전 사이트",
    source_type: "external",
    enabled: true,
    priority: 5,
    crawl_method: "html",
    crawl_interval_minutes: 720
  }
];
