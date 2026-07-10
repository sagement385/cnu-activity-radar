export type DigestPeriod = "morning" | "evening" | "manual";

export type RecommendationStatus = "recommend" | "maybe" | "exclude";

export type Source = {
  id: string;
  name: string;
  url: string;
  source_type: "university" | "department" | "external";
  enabled: boolean;
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
    department: string;
    region: string;
    target?: string;
  };
  schedule: {
    mode: "flexible";
    unavailable_times: ScheduleItem[];
    rules?: Record<string, string>;
  };
  preferences: {
    include_categories: string[];
    exclude_keywords: string[];
    priority_keywords: string[];
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
  };
};

export type ScrapedOpportunity = {
  stableKey: string;
  title: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  organization?: string | null;
  category?: string;
  location?: string | null;
  deadline?: string | null;
  recruitmentStart?: string | null;
  activityStart?: string | null;
  activityEnd?: string | null;
  benefits?: string | null;
  requirements?: string | null;
  summary?: string | null;
  rawText: string;
  tags?: string[];
};

export type OpportunityRow = {
  id: string;
  stable_key: string;
  title: string;
  source_id: string | null;
  source_name: string;
  source_url: string;
  original_url: string;
  organization: string | null;
  category: string;
  location: string | null;
  deadline: string | null;
  recruitment_start: string | null;
  activity_start: string | null;
  activity_end: string | null;
  benefits: string | null;
  requirements: string | null;
  summary: string | null;
  raw_text: string;
  tags: string[];
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
};

export type OpportunityWithRecommendation = OpportunityRow & {
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
    last_notified_at: string | null;
    notification_count: number;
  };
};
