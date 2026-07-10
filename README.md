# CNU Activity Radar

전남대학교와 기계공학부 공지, 링커리어 대외활동을 매일 훑고 사용자 조건에 맞는 공고만 아침/저녁 카카오톡으로 보내는 개인 맞춤 공고 큐레이터입니다.

## 핵심 기능

- 전남대 행사/비교과, 대표 공지, 기계공학부 공지 스크래핑
- 링커리어 키워드 기반 대외활동 스크래핑
- 서포터즈, 공모전, 대외활동, 교내 프로그램, 장학/활동비, 현장실습 분류
- 근로장학생, SNS 중심 활동, 수도권 정기 오프라인 활동 감점/제외
- 기계공학/공대, 공공기관, 대기업, 활동비, 광주/온라인 활동 가점
- 아침 8시, 저녁 9시 카카오톡 나에게 보내기
- 웹 대시보드와 설정 화면

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Codex 번들 런타임을 쓰는 경우:

```powershell
& "C:\Users\whrjs\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" install
& "C:\Users\whrjs\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
```

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. Render 또는 `.env.local`에 아래 값을 넣습니다.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## 카카오톡 설정

MVP는 카카오톡 `나에게 보내기` 방식입니다.

필요한 값:

```env
KAKAO_REST_API_KEY=
KAKAO_REFRESH_TOKEN=
```

초기 OAuth 동의 과정에서 `talk_message` 권한이 필요합니다. 운영 중에는 refresh token으로 access token을 갱신해 발송합니다.

## Render 배포

포트폴리오 프로젝트와 같은 방식으로 `render.yaml`을 포함했습니다.

- web service: 대시보드와 API
- cron service 1: 매일 08:00 KST 아침 digest
- cron service 2: 매일 21:00 KST 저녁 digest

Render cron은 UTC 기준이라 `08:00 KST = 23:00 UTC`, `21:00 KST = 12:00 UTC`입니다.

## 보안

```env
CRON_SECRET=
DASHBOARD_SECRET=
```

- `CRON_SECRET`: `/api/cron/digest` 직접 호출 보호
- `DASHBOARD_SECRET`: 대시보드 접속 보호

대시보드는 처음 한 번 아래처럼 접속하면 쿠키가 저장됩니다.

```text
https://your-app.onrender.com?dashboard_secret=YOUR_SECRET
```

## 수동 실행

```bash
pnpm scrape
pnpm digest -- manual
pnpm digest -- morning
pnpm digest -- evening
```

카톡 없이 메시지만 확인하려면:

```env
NOTIFICATION_DRY_RUN=true
```
