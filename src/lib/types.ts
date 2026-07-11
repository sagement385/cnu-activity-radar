export type DigestPeriod = "morning" | "evening" | "manual";

export type RecommendationStatus = "recommend" | "maybe" | "exclude";

export type InterestLevel = "very_high" | "high" | "normal" | "low" | "exclude";
export type CategoryMode = "include" | "low" | "exclude";

export type InterestKeyword = {
  keyword: string;
  level: InterestLevel;
};

export type RecommendationWeights = {
  major_match: number;
  interest_match: number;
  location_match: number;
  schedule_match: number;
  benefit_match: number;
  source_reliability: number;
};

export type RecommendationAdjustments = {
  jnu_official: number;
  mechanical_official: number;
  international_official: number;
  gwangju_offline: number;
  online: number;
  paid_benefit: number;
  unknown_deadline: number;
  unclear_target: number;
  sns_core: number;
  simple_event: number;
};

export type SourceParserConfig = {
  link_selector?: string;
  link_pattern?: string;
  item_selector?: string;
  title_selector?: string;
  limit?: number;
  detail_limit?: number;
};

export type Source = {
  id: string;
  name: string;
  url: string;
  organization?: string;
  source_group?: string;
  source_type: string;
  base_url?: string;
  list_url?: string;
  enabled: boolean;
  priority?: number;
  crawl_method?: string;
  crawl_interval_minutes?: number;
  parser_config?: SourceParserConfig;
  last_scraped_at?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  last_item_count?: number;
  last_new_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type ScheduleItem = {
  title: string;
  days: string[];
  start_time: string;
  end_time: string;
  location?: string;
  adjustable: boolean;
  active: boolean;
};

export type AppSettings = {
  id: string;
  profile: {
    school: string;
    college?: string;
    department: string;
    grade?: string;
    enrollment_status?: string;
    region: string;
    movable_regions?: string[];
    max_travel_minutes?: number;
    target?: string;
    desired_career?: string;
    desired_roles?: string[];
  };
  schedule: {
    mode: "flexible";
    unavailable_times: ScheduleItem[];
    activity_modes?: string[];
    weekday_start?: string;
    weekday_end?: string;
    weekend_days?: string[];
    conflict_rule?: "exclude" | "penalty" | "review";
    unclear_schedule_rule?: "exclude" | "review" | "allow";
    flexible_bonus?: boolean;
    rules?: Record<string, string>;
  };
  preferences: {
    include_categories: string[];
    excluded_categories: string[];
    category_modes?: Record<string, CategoryMode>;
    interest_keywords?: InterestKeyword[];
    exclude_keywords: string[];
    priority_keywords: string[];
    review_keywords?: string[];
    avoid_sns_core: boolean;
    prefer_paid: boolean;
    deadline_soon_days: number;
    max_digest_items: number;
  };
  notification: {
    channel: "kakao";
    morning_time: string;
    evening_time: string;
    enabled: boolean;
    morning_enabled?: boolean;
    evening_enabled?: boolean;
    minimum_score?: number;
    include_maybe?: boolean;
    prevent_duplicates?: boolean;
    alert_types?: string[];
  };
  recommendation?: {
    weights: RecommendationWeights;
    adjustments: RecommendationAdjustments;
    min_recommend_score: number;
  };
};

export type OpportunitySourceRef = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
};

export type ScrapedOpportunity = {
  stableKey: string;
  title: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  posterUrl?: string | null;
  organization?: string | null;
  category?: string;
  subCategory?: string | null;
  campusScope?: "교내" | "교외";
  target?: string[];
  allowedGrades?: string[];
  allowedMajors?: string[];
  location?: string | null;
  activityType?: "온라인" | "오프라인" | "혼합" | "미확인";
  deadline?: string | null;
  recruitmentStart?: string | null;
  activityStart?: string | null;
  activityEnd?: string | null;
  benefits?: string | null;
  requirements?: string | null;
  summary?: string | null;
  eligibilityStatus?: "지원 가능" | "조건 확인 필요" | "지원 불가";
  deadlineConfidence?: "high" | "medium" | "low";
  dataConfidence?: "high" | "medium" | "low";
  rawText: string;
  tags?: string[];
  sourceRefs?: OpportunitySourceRef[];
};

export type OpportunityRow = {
  id: string;
  stable_key: string;
  title: string;
  source_id: string | null;
  source_name: string;
  source_url: string;
  original_url: string;
  poster_url: string | null;
  organization: string | null;
  category: string;
  sub_category?: string | null;
  campus_scope?: string;
  target?: string[];
  allowed_grades?: string[];
  allowed_majors?: string[];
  location: string | null;
  region?: string | null;
  activity_type?: string;
  deadline: string | null;
  application_deadline?: string | null;
  recruitment_start: string | null;
  activity_start: string | null;
  activity_end: string | null;
  benefits: string | null;
  requirements: string | null;
  summary: string | null;
  raw_text: string;
  tags: string[];
  eligibility_status?: string;
  deadline_confidence?: string;
  data_confidence?: string;
  collected_at?: string;
  first_seen_at: string;
  last_seen_at: string;
};

export type Recommendation = {
  opportunity_id: string;
  score: number;
  status: RecommendationStatus;
  reasons: string[];
  warnings: string[];
  excluded_reasons: string[];
  schedule_conflict: "none" | "adjustable" | "fixed" | "unknown";
  sns_required: boolean;
  is_paid: boolean;
  is_major_relevant: boolean;
  score_breakdown: Record<string, number>;
};

export type OpportunityWithRecommendation = OpportunityRow & {
  source_refs?: OpportunitySourceRef[];
  recommendation?: {
    score: number;
    status: RecommendationStatus;
    reasons: string[];
    warnings: string[];
    excluded_reasons: string[];
    schedule_conflict: string;
    sns_required: boolean;
    is_paid: boolean;
    is_major_relevant: boolean;
    score_breakdown?: Record<string, number>;
    last_notified_at: string | null;
    notification_count: number;
  };
};
