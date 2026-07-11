create extension if not exists pgcrypto;

create table if not exists app_settings (
  id text primary key default 'default',
  profile jsonb not null,
  schedule jsonb not null,
  preferences jsonb not null,
  notification jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  name text not null,
  url text not null,
  source_type text not null,
  enabled boolean not null default true,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique,
  title text not null,
  source_id text references sources(id) on delete set null,
  source_name text not null,
  source_url text not null,
  original_url text not null,
  poster_url text,
  organization text,
  category text not null default '대외활동',
  location text,
  deadline date,
  recruitment_start date,
  activity_start date,
  activity_end date,
  benefits text,
  requirements text,
  summary text,
  raw_text text not null,
  tags text[] not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  settings_id text not null references app_settings(id) on delete cascade default 'default',
  score integer not null,
  status text not null check (status in ('recommend', 'maybe', 'exclude')),
  reasons text[] not null default '{}',
  warnings text[] not null default '{}',
  excluded_reasons text[] not null default '{}',
  schedule_conflict text not null default 'unknown',
  sns_required boolean not null default false,
  is_paid boolean not null default false,
  is_major_relevant boolean not null default false,
  last_notified_at timestamptz,
  notification_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, settings_id)
);

create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  settings_id text not null references app_settings(id) on delete cascade default 'default',
  period text not null check (period in ('morning', 'evening', 'manual')),
  channel text not null default 'kakao',
  opportunity_ids uuid[] not null default '{}',
  message_preview text not null,
  sent_at timestamptz not null default now(),
  success boolean not null default true,
  error_message text
);

create table if not exists run_logs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,
  status text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_opportunities_deadline on opportunities(deadline);
create index if not exists idx_opportunities_source on opportunities(source_id);
create index if not exists idx_opportunities_last_seen on opportunities(last_seen_at desc);
create index if not exists idx_recommendations_status_score on recommendations(status, score desc);
create index if not exists idx_notification_logs_sent_at on notification_logs(sent_at desc);

alter table opportunities add column if not exists poster_url text;

insert into app_settings (id, profile, schedule, preferences, notification)
values (
  'default',
  '{
    "school": "전남대학교",
    "department": "기계공학과",
    "region": "광주",
    "target": "스펙에 도움되는 교내/외 활동을 놓치지 않기"
  }',
  '{
    "mode": "flexible",
    "unavailable_times": [
      {
        "title": "전주 알바",
        "days": ["금", "토", "일"],
        "start_time": "09:00",
        "end_time": "15:00",
        "location": "전주",
        "adjustable": true,
        "active": true
      },
      {
        "title": "센터 알바",
        "days": ["화", "목"],
        "start_time": "17:00",
        "end_time": "19:00",
        "location": "광주",
        "adjustable": true,
        "active": true
      }
    ],
    "rules": {
      "unclear_schedule": "검토 필요",
      "fixed_conflict": "감점",
      "adjustable_conflict": "약한 감점",
      "online_or_flexible": "가점"
    }
  }',
  '{
    "include_categories": ["서포터즈", "공모전", "대외활동", "교내 프로그램", "장학·활동비", "교육·캠프", "취업·멘토링"],
    "excluded_categories": ["현장실습·인턴"],
    "exclude_keywords": ["근로장학생", "국가근로", "대학근로", "현장실습", "인턴", "채용연계", "실습학기제", "실습생", "SNS 필수", "인스타 필수", "릴스 필수", "블로그 필수", "유튜브 홍보", "수도권 정기", "서울 정기"],
    "priority_keywords": ["기계공학", "공학", "공대", "제조", "모빌리티", "자동차", "로봇", "AI", "에너지", "공공기관", "대기업", "활동비", "장학금", "수료증", "기수", "서포터즈"],
    "avoid_sns_core": true,
    "prefer_paid": true,
    "deadline_soon_days": 5,
    "max_digest_items": 5
  }',
  '{
    "channel": "kakao",
    "morning_time": "08:00",
    "evening_time": "21:00",
    "enabled": true
  }'
)
on conflict (id) do nothing;

update app_settings
set preferences = preferences || '{"excluded_categories": ["현장실습·인턴"]}'::jsonb,
    updated_at = now()
where id = 'default'
  and not (preferences ? 'excluded_categories');

insert into sources (id, name, url, source_type)
values
  ('jnu_events', '전남대 행사/비교과', 'https://events.jnu.ac.kr/Search.aspx?mode=text&query=', 'university'),
  ('jnu_main_notice', '전남대 대표 공지', 'https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5', 'university'),
  ('jnu_mech_notice', '전남대 기계공학부 공지', 'https://mech.jnu.ac.kr/mech/8218/subview.do', 'department'),
  ('linkareer_activity', '링커리어 대외활동', 'https://linkareer.com/list/activity', 'external'),
  ('allforyoung_activity', '올포영 대외활동/공모전', 'https://www.allforyoung.com/posts/contest', 'external'),
  ('thinkcontest_activity', '씽굿 공모전/대외활동', 'https://www.thinkcontest.com/Contest/CateField.html?c=1', 'external')
on conflict (id) do update
set name = excluded.name,
    url = excluded.url,
    source_type = excluded.source_type,
    updated_at = now();

-- Apply supabase/migrations/20260711_improvement_spec.sql after this base schema.
