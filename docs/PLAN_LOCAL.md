## 로컬 Supabase 전용 테스트 전환 계획 (동일 DB 스택)

### 요약
- 목표: **클라우드 Supabase 없이** 로컬에서만 DB/Auth/API가 동작하도록 환경을 고정
- 방식: `Docker + Supabase CLI(local stack)` 사용 (Postgres 단독이 아니라 GoTrue/PostgREST 포함)
- 현재 확인된 사실:
  - Docker 설치/데몬 실행됨 (`Docker 29.2.0`, Server `28.4.0`)
  - Supabase CLI 미설치
  - 마이그레이션이 `auth.users`, `auth.uid()`에 의존하므로 Postgres 단독 로컬은 비호환
- 결정사항:
  - CLI는 **프로젝트 로컬(npx)** 방식
  - 데이터는 **기본 유지**, 필요 시 `reset`
  - `.env.local`은 **자동 동기화 스크립트**로 관리

---

## 1) 구현 범위 (변경 대상)

### 1.1 인프라/도구
- `devDependency`에 `supabase` CLI 추가
- `supabase/config.toml` 생성/관리 (`supabase init --force`)
- 로컬 실행 스크립트 추가:
  - `db:local:start`
  - `db:local:stop`
  - `db:local:status`
  - `db:local:reset`
  - `env:local:sync`
  - `local:up` (start + env sync)
  - `local:down` (stop)

### 1.2 환경변수 인터페이스 (중요)
- `.env.local` 자동 생성/갱신 규칙 추가
  - `NEXT_PUBLIC_SUPABASE_URL` ← `API_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← `ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ← `SERVICE_ROLE_KEY`
  - `ADMIN_BOOTSTRAP_EMAIL` 기본값 `admin@local.test` (없으면 자동 설정)
  - 기존 rate-limit 변수는 유지 (없으면 기본값 기록)

### 1.3 앱 API/타입 인터페이스
- HTTP API 경로/DTO/DB 타입 변경 없음
- 런타임 구성 인터페이스만 변경 (로컬 env 자동화)

---

## 2) 상세 구현 절차 (결정 완료)

1. Supabase CLI 로컬 설치
- `npm install -D supabase`

2. Supabase 로컬 프로젝트 초기화
- `npx supabase init --force`
- 기존 `supabase/migrations/*.sql` 유지

3. 로컬 Auth 정책 명시 (즉시 가입 정책 유지)
- `supabase/config.toml`에서 이메일 확인 요구를 끄는 설정을 명시  
  (로컬에서도 “가입 즉시 세션” 동작 보장)

4. 자동 env 동기화 스크립트 추가
- 파일: `scripts/sync-local-supabase-env.sh`
- 로직:
  - `npx supabase status -o env` 실행
  - `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` 파싱
  - `.env.local`에 필요한 키를 원자적으로 재작성(`.tmp` 후 `mv`)
  - `ADMIN_BOOTSTRAP_EMAIL` 없으면 `admin@local.test` 기본 주입
  - rate-limit 기본값 함께 기록

5. npm scripts 추가
- `db:local:start`: `npx supabase start`
- `db:local:stop`: `npx supabase stop`
- `db:local:status`: `npx supabase status`
- `db:local:reset`: `npx supabase db reset`
- `env:local:sync`: `bash scripts/sync-local-supabase-env.sh`
- `local:up`: `npm run db:local:start && npm run env:local:sync`
- `local:down`: `npm run db:local:stop`

6. 로컬 테스트 표준 실행 순서 문서화
- `npm run local:up`
- `npm run db:local:reset` (최초/스키마 변경 시)
- `npm run dev`
- 상태 확인: `GET /api/health`

7. README 업데이트
- “로컬 전용 테스트” 섹션 추가
- 최초 1회 관리자 생성 시나리오 명시:
  - `admin@local.test`로 회원가입 → 자동 admin 승격 → 보드 생성/복제 테스트

---

## 3) 검증 시나리오 (완료 기준)

1. 인프라 기동
- `npm run local:up` 성공
- `npm run db:local:status`에서 로컬 Supabase 서비스 정보 확인

2. DB/마이그레이션
- `npm run db:local:reset` 성공
- 핵심 테이블 존재 확인: `profiles`, `boards`, `posts`, `comments`, `reports`, `rate_limits`, `app_settings`
- 트리거/함수 존재 확인: `handle_new_user_profile`, `consume_rate_limit`

3. 앱 런타임
- `npm run dev` 후 `/api/health`가 `ok: true` 반환
- 회원가입/로그인 성공
- `ADMIN_BOOTSTRAP_EMAIL` 계정 1회 admin 승격 확인
- 게시판 생성/복제 및 글/댓글/신고 흐름 정상

4. 회귀
- `npm run lint`, `npm run test`, `npm run build` 모두 통과

---

## 4) 장애/엣지케이스 처리

- Docker 미기동: `db:local:start`에서 실패 → Docker 실행 안내
- 포트 충돌: Supabase 기본 포트 충돌 시 `supabase/config.toml` 포트 변경
- CLI 버전 불일치: `npx` 고정 사용으로 팀 간 충돌 최소화
- env 누락: `env:local:sync` 실패 시 명확한 에러 메시지로 중단
- 데이터 꼬임: `db:local:reset`를 표준 복구 루트로 사용

---

## 5) 가정/기본값

- 로컬 테스트는 Supabase Cloud 연결 없이 진행
- seed 데이터는 필수 아님 (최초 admin 회원가입 후 UI로 운영 데이터 생성)
- 데이터 유지가 기본이며, 재현 테스트가 필요할 때만 reset
- `ADMIN_BOOTSTRAP_EMAIL` 기본값은 `admin@local.test`

---

## 6) 참고 문서 (명령/동작 근거)

- Supabase Local Development: https://supabase.com/docs/guides/local-development
- Supabase CLI Getting Started: https://supabase.com/docs/guides/local-development/cli/getting-started
- Supabase CLI `init` (`--force` 포함): https://supabase.com/docs/reference/cli/supabase-init
- Supabase CLI `status` (env 출력): https://supabase.com/docs/reference/cli/supabase-status
