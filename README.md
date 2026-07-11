# CNU Activity Radar

전남대학교 재학생의 학교·학과·관심 분야·지역·일정 조건을 바탕으로 교내외 활동 공고를 수집하고 추천하는 개인 맞춤형 탐색 서비스입니다.

## 주요 기능

- 전남대 대표 공지, 행사·비교과, 국제협력과, 대학일자리플러스센터, 교육혁신본부, 공과대학, 기계공학부 공지 수집
- 링커리어·올포영·씽굿 외부 공고 수집
- DB 기반 수집처 Registry, 출처별 활성화·우선순위·주기·실행 로그 관리
- 공모전, 국제교류, 장학금 및 활동비, 취업 및 진로, 연구 등 통합 카테고리 분류
- 전공·관심 분야·지역·일정·혜택·출처 신뢰도 가중치 기반 추천
- 근로장학생, 인턴·현장실습, SNS 핵심 활동, 지원 대상 불일치 자동 제외
- 동일 공고 다중 출처 병합 및 공식 출처 우선 표시
- 카카오톡 아침·저녁 알림 조건 관리
- 모바일 관리자 제어판에서 JSON 없이 프로필·일정·키워드·가중치·알림 편집

페이지 접속만으로는 수집하지 않습니다. 홈의 `지금 수집` 또는 관리자 수집처 카드의 `지금 수집`을 눌렀을 때만 실행합니다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Supabase

새 프로젝트는 SQL Editor에서 아래 순서로 실행합니다.

```text
supabase/schema.sql
supabase/migrations/20260711_improvement_spec.sql
```

운영 중인 기존 프로젝트에는 마이그레이션 파일만 실행합니다. 기존 행은 삭제하지 않고 새 컬럼과 테이블만 추가합니다.

## 필수 환경변수

```env
NEXT_PUBLIC_APP_URL=
USE_SUPABASE=true
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DASHBOARD_SECRET=
ADMIN_SESSION_SECRET=
CRON_SECRET=
```

`DASHBOARD_SECRET`은 기존 배포와의 호환용 관리자 비밀번호입니다. 새 배포에서는 `ADMIN_PASSWORD_HASH`에 `scrypt$<salt>$<hash>` 형식을 사용할 수 있습니다. 관리자 세션 쿠키에는 비밀번호가 아니라 8시간 만료 서명 토큰만 저장됩니다.

카카오톡과 Gemini를 사용할 때만 아래 값을 추가합니다.

```env
KAKAO_REST_API_KEY=
KAKAO_REFRESH_TOKEN=
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
```

## 실행과 검증

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test:sources
pnpm scrape
pnpm digest -- manual
```

`pnpm test:sources`는 운영 DB에 쓰지 않고 공식 목록 접근과 파싱 결과만 출력합니다. 수집 실패는 가짜 공고로 대체하지 않으며 `crawl_runs`에 출처별 오류로 기록합니다.

## Render

`render.yaml`의 웹 서비스가 Next.js 대시보드와 API를 실행합니다. 무료 인스턴스가 잠든 경우 첫 요청이 느릴 수 있습니다. 수동 수집 결과는 Supabase에 유지되므로 재접속 시 마지막 저장 결과가 표시됩니다.
