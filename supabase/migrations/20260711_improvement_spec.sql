begin;

alter table app_settings
  add column if not exists recommendation jsonb not null default '{
    "weights": {
      "major_match": 30,
      "interest_match": 25,
      "location_match": 15,
      "schedule_match": 15,
      "benefit_match": 10,
      "source_reliability": 5
    },
    "adjustments": {
      "jnu_official": 15,
      "mechanical_official": 20,
      "international_official": 10,
      "gwangju_offline": 10,
      "online": 8,
      "paid_benefit": 10,
      "unknown_deadline": -10,
      "unclear_target": -10,
      "sns_core": -25,
      "simple_event": -30
    },
    "min_recommend_score": 70
  }'::jsonb;

alter table sources add column if not exists organization text;
alter table sources add column if not exists source_group text not null default '직접 추가한 출처';
alter table sources add column if not exists base_url text;
alter table sources add column if not exists list_url text;
alter table sources add column if not exists priority integer not null default 5;
alter table sources add column if not exists crawl_method text not null default 'html';
alter table sources add column if not exists crawl_interval_minutes integer not null default 360;
alter table sources add column if not exists parser_config jsonb not null default '{}'::jsonb;
alter table sources add column if not exists last_success_at timestamptz;
alter table sources add column if not exists last_failure_at timestamptz;
alter table sources add column if not exists last_error text;
alter table sources add column if not exists last_item_count integer not null default 0;
alter table sources add column if not exists last_new_count integer not null default 0;

update sources
set list_url = coalesce(list_url, url),
    base_url = coalesce(base_url, substring(url from '^(https?://[^/]+)')),
    organization = coalesce(organization, name)
where list_url is null or base_url is null or organization is null;

alter table opportunities add column if not exists original_title text;
alter table opportunities add column if not exists sub_category text;
alter table opportunities add column if not exists campus_scope text not null default '교외';
alter table opportunities add column if not exists target text[] not null default '{}';
alter table opportunities add column if not exists allowed_grades text[] not null default '{}';
alter table opportunities add column if not exists allowed_majors text[] not null default '{}';
alter table opportunities add column if not exists region text;
alter table opportunities add column if not exists activity_type text not null default '미확인';
alter table opportunities add column if not exists application_start date;
alter table opportunities add column if not exists application_deadline date;
alter table opportunities add column if not exists scholarship_amount numeric;
alter table opportunities add column if not exists activity_fee numeric;
alter table opportunities add column if not exists description text;
alter table opportunities add column if not exists eligibility_status text not null default '조건 확인 필요';
alter table opportunities add column if not exists deadline_confidence text not null default 'low';
alter table opportunities add column if not exists data_confidence text not null default 'medium';
alter table opportunities add column if not exists collected_at timestamptz not null default now();
alter table opportunities add column if not exists canonical_key text;

update opportunities
set original_title = coalesce(original_title, title),
    application_start = coalesce(application_start, recruitment_start),
    application_deadline = coalesce(application_deadline, deadline),
    description = coalesce(description, summary),
    campus_scope = case when source_id like 'jnu_%' then '교내' else campus_scope end,
    collected_at = coalesce(collected_at, first_seen_at)
where original_title is null
   or application_deadline is null
   or description is null
   or canonical_key is null;

alter table recommendations add column if not exists score_breakdown jsonb not null default '{}'::jsonb;

create table if not exists crawl_runs (
  id uuid primary key default gen_random_uuid(),
  source_id text references sources(id) on delete set null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  success boolean not null,
  collected_count integer not null default 0,
  new_count integer not null default 0,
  duplicate_count integer not null default 0,
  parse_failure_count integer not null default 0,
  http_status integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  source_id text references sources(id) on delete set null,
  source_name text not null,
  source_url text not null,
  original_url text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (opportunity_id, source_id, original_url)
);

create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier_hash text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_sources_group_priority on sources(source_group, priority desc);
create index if not exists idx_opportunities_canonical_key on opportunities(canonical_key);
create index if not exists idx_crawl_runs_source_started on crawl_runs(source_id, started_at desc);
create index if not exists idx_opportunity_sources_opportunity on opportunity_sources(opportunity_id);
create index if not exists idx_admin_login_attempts_identifier on admin_login_attempts(identifier_hash, created_at desc);

insert into sources (
  id, name, url, source_type, enabled, organization, source_group, base_url, list_url,
  priority, crawl_method, crawl_interval_minutes, parser_config
)
values
  ('jnu_events', '전남대 행사/비교과', 'https://events.jnu.ac.kr/Search.aspx?mode=text&query=', 'university', true, '전남대학교', '전남대학교 대표', 'https://events.jnu.ac.kr', 'https://events.jnu.ac.kr/Search.aspx?mode=text&query=', 10, 'jnu_events', 360, '{}'::jsonb),
  ('jnu_main_notice', '전남대 대표 공지', 'https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5', 'university', true, '전남대학교', '전남대학교 대표', 'https://www.jnu.ac.kr', 'https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5', 9, 'jnu_board', 360, '{}'::jsonb),
  ('jnu_international_notice', '전남대 국제협력과 공지', 'https://international.jnu.ac.kr/Board/Notice.aspx', 'international', true, '전남대학교 국제협력과', '국제협력', 'https://international.jnu.ac.kr', 'https://international.jnu.ac.kr/Board/Notice.aspx', 10, 'registry_html', 360, '{"link_pattern":"/Board/Board\\.aspx\\?BoardID=.*Mode=View","limit":24,"detail_limit":12}'::jsonb),
  ('jnu_jobcenter_notice', '전남대 대학일자리플러스센터', 'https://jobcenter.jnu.ac.kr/?mid=0104', 'career', true, '전남대학교 대학일자리플러스센터', '취업 및 진로', 'https://jobcenter.jnu.ac.kr', 'https://jobcenter.jnu.ac.kr/?mid=0104', 8, 'registry_html', 360, '{"link_pattern":"act=dtl.*mid=0104|mid=0104.*act=dtl","limit":24,"detail_limit":12}'::jsonb),
  ('jnu_education_innovation', '전남대 교육혁신본부', 'https://ile.jnu.ac.kr/ko/community/notice', 'education', true, '전남대학교 교육혁신본부', '비교과 및 교육', 'https://ile.jnu.ac.kr', 'https://ile.jnu.ac.kr/ko/community/notice', 8, 'registry_html', 360, '{"link_pattern":"/ko/community/notice/(?:view/)?[0-9]+","limit":24,"detail_limit":12}'::jsonb),
  ('jnu_engineering_notice', '전남대 공과대학 공지', 'https://eng.jnu.ac.kr/eng/7343/subview.do', 'engineering', true, '전남대학교 공과대학', '공과대학', 'https://eng.jnu.ac.kr', 'https://eng.jnu.ac.kr/eng/7343/subview.do', 10, 'registry_html', 360, '{"link_pattern":"artclView\\.do","limit":24,"detail_limit":12}'::jsonb),
  ('jnu_mech_notice', '전남대 기계공학부 공지', 'https://mech.jnu.ac.kr/mech/8218/subview.do', 'department', true, '전남대학교 기계공학부', '기계공학부', 'https://mech.jnu.ac.kr', 'https://mech.jnu.ac.kr/mech/8218/subview.do', 10, 'jnu_board', 360, '{}'::jsonb),
  ('linkareer_activity', '링커리어 대외활동', 'https://linkareer.com/list/activity', 'external', true, '링커리어', '외부 대외활동 사이트', 'https://linkareer.com', 'https://linkareer.com/list/activity', 6, 'linkareer', 720, '{}'::jsonb),
  ('allforyoung_activity', '올포영 대외활동/공모전', 'https://www.allforyoung.com/posts/contest', 'external', true, '올포영', '공모전 사이트', 'https://www.allforyoung.com', 'https://www.allforyoung.com/posts/contest', 6, 'allforyoung', 720, '{}'::jsonb),
  ('thinkcontest_activity', '씽굿 공모전/대외활동', 'https://www.thinkcontest.com/Contest/CateField.html?c=1', 'external', true, '씽굿', '공모전 사이트', 'https://www.thinkcontest.com', 'https://www.thinkcontest.com/Contest/CateField.html?c=1', 5, 'html', 720, '{}'::jsonb)
on conflict (id) do update
set name = excluded.name,
    url = excluded.url,
    source_type = excluded.source_type,
    organization = excluded.organization,
    source_group = excluded.source_group,
    base_url = excluded.base_url,
    list_url = excluded.list_url,
    priority = excluded.priority,
    crawl_method = excluded.crawl_method,
    crawl_interval_minutes = excluded.crawl_interval_minutes,
    parser_config = case when sources.parser_config = '{}'::jsonb then excluded.parser_config else sources.parser_config end,
    updated_at = now();

alter table app_settings enable row level security;
alter table sources enable row level security;
alter table opportunities enable row level security;
alter table recommendations enable row level security;
alter table notification_logs enable row level security;
alter table run_logs enable row level security;
alter table crawl_runs enable row level security;
alter table opportunity_sources enable row level security;
alter table admin_login_attempts enable row level security;

commit;
