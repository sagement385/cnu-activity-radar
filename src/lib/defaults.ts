import type { AppSettings, Source } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "default",
  profile: {
    school: "전남대학교",
    department: "기계공학과",
    region: "광주",
    target: "스펙에 도움되는 교내/외 활동을 놓치지 않기"
  },
  schedule: {
    mode: "flexible",
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
    include_categories: ["서포터즈", "공모전", "대외활동", "교내 프로그램", "장학·활동비", "현장실습·인턴", "교육·캠프"],
    exclude_keywords: ["근로장학생", "국가근로", "SNS 필수", "인스타 필수", "릴스", "블로그 필수", "유튜브 홍보", "수도권 정기"],
    priority_keywords: ["기계공학", "공학", "공대", "제조", "모빌리티", "자동차", "로봇", "AI", "에너지", "공공기관", "대기업", "활동비", "장학금", "수료증", "기수", "서포터즈"],
    avoid_sns_core: true,
    prefer_paid: true,
    deadline_soon_days: 5,
    max_digest_items: 5
  },
  notification: {
    channel: "kakao",
    morning_time: "08:00",
    evening_time: "21:00",
    enabled: true
  }
};

export const DEFAULT_SOURCES: Source[] = [
  {
    id: "jnu_events",
    name: "전남대 행사/비교과",
    url: "https://events.jnu.ac.kr/Search.aspx?mode=text&query=",
    source_type: "university",
    enabled: true
  },
  {
    id: "jnu_main_notice",
    name: "전남대 대표 공지",
    url: "https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5",
    source_type: "university",
    enabled: true
  },
  {
    id: "jnu_mech_notice",
    name: "전남대 기계공학부 공지",
    url: "https://mech.jnu.ac.kr/mech/8218/subview.do",
    source_type: "department",
    enabled: true
  },
  {
    id: "linkareer_activity",
    name: "링커리어 대외활동",
    url: "https://linkareer.com/list/activity",
    source_type: "external",
    enabled: true
  }
];
