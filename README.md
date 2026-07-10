# CNU Activity Radar

전남대학교와 기계공학부 공지, 링커리어 대외활동을 훑고 사용자 조건에 맞는 공고만 정리하는 개인 맞춤 공고 큐레이터입니다.

## 핵심 기능

- 전남대 행사/비교과, 대표 공지, 기계공학부 공지 스크래핑
- 링커리어 키워드 기반 대외활동 스크래핑
- 서포터즈, 공모전, 대외활동, 교내 프로그램, 장학/활동비, 현장실습 분류
- 근로장학생, SNS 중심 활동, 수도권 정기 오프라인 활동 감점/제외
- 기계공학/공대, 공공기관, 대기업, 활동비, 광주/온라인 활동 가점
- 사이트 접속 시 자동 스크랩
- 탭을 열어둔 상태에서 1시간마다 새 공고 확인
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

카카오톡 발송 로직은 남겨두었지만, 무료 배포 버전에서는 cron을 사용하지 않습니다. 나중에 정기 발송을 다시 켤 때 `나에게 보내기` 방식으로 연결하면 됩니다.

필요한 값:

```env
KAKAO_REST_API_KEY=
KAKAO_REFRESH_TOKEN=
```

초기 OAuth 동의 과정에서 `talk_message` 권한이 필요합니다. 운영 중에는 refresh token으로 access token을 갱신해 발송합니다.

## Render 배포

포트폴리오 프로젝트와 같은 방식으로 `render.yaml`을 포함했습니다.

- web service: 대시보드와 API
- plan: free
- 동작 방식: 사이트 접속 시 `/api/scrape`가 호출되고, 최근 스크랩 후 60분이 지났으면 새로 수집합니다.

무료 웹 서비스는 오래 접속하지 않으면 잠들 수 있어 첫 접속이 느릴 수 있습니다. 그래도 접속하면 다시 깨어나서 스크랩합니다.

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
```

카톡 없이 메시지만 확인하려면:

```env
NOTIFICATION_DRY_RUN=true
```
