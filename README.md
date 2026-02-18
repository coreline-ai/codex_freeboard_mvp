# ✨ FreeBoard MVP

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Next.js + Supabase 기반 자유 게시판 MVP입니다.  
회원가입/로그인, 다중 게시판, 게시글/댓글/신고/좋아요, 관리자 운영 기능, 통합 검색(FTS), 로컬 Supabase 스택 테스트까지 포함합니다.

<img width="2946" height="3260" alt="screencapture-127-0-0-1-3000-2026-02-18-21_14_38" src="https://github.com/user-attachments/assets/83769c55-33e1-41b5-bd75-b61ec8d7261e" />

# 🚀 one-shot prompt (Codex 5.3 Plan-Mode)
자유 게시판을 만들꺼야! 게시판의 기본 기능은 웹을 통해 확인 하고, 필요한 기능은 모두 추가 해줘! 관리자 모드를 만들어 게시판 무한 복사 및 생성이 가능해야해! 개별 유저 가입 로그인 기능도 들어가야하고 관리자는 기본 유저 관리도 가능 해야해. 배포는 netifly에 가능한 구조로 우선 작업 되어야해, 디비는 슈파베이스를 이용할꺼야. 구현 시작

## 🔍 목차

- [핵심 구현 기능](#핵심-구현-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [화면 라우트](#화면-라우트)
- [API 라우트](#api-라우트)
- [데이터베이스 설계](#데이터베이스-설계)
- [통합 검색 FTS](#통합-검색-fts)
- [로컬 실행 (Supabase Local Stack)](#로컬-실행-supabase-local-stack)
- [환경변수](#환경변수)
- [스크립트](#스크립트)
- [테스트](#테스트)
- [Netlify 배포](#netlify-배포)
- [운영 메모](#운영-메모)

## 🧱 핵심 구현 기능

### 사용자 기능

- 이메일/비밀번호 회원가입, 로그인 (`/signup`, `/login`)
- 이메일 인증 없이 즉시 세션 발급 (로컬 설정 기준)
- 게시판 목록/진입 (`/b/[slug]`)
- 글 작성/수정/소프트 삭제
- 댓글/대댓글(1단계) 작성/수정/소프트 삭제
- 게시글 좋아요 토글
- 게시글/댓글 신고
- 통합 검색 (`/search`) 및 보드 내 검색 (`/b/[slug]?q=...`)

### 관리자 기능

- 관리자 대시보드 (`/admin`)
- 게시판 직접 생성/복제 (`/admin/boards`)
- 게시판 복제 시 slug 충돌 자동 해결 (`-2`, `-3`, ...)
- 유저 목록/검색/권한 변경/정지/복구/활동 조회 (`/admin/users`)
- 신고 목록 조회 및 처리 (`/admin/reports`)
- 게시글/댓글 상태 모더레이션 (`published/hidden/deleted`)
- 모더레이션 감사 로그 저장 (`moderation_actions`)

### 보안/운영 기능

- RLS(Row Level Security) + 서버 전용 `service_role` 분리
- 정지 유저 쓰기 제한(글/댓글/좋아요/신고)
- IP + 계정 기반 레이트리밋 (`rate_limits` + RPC)
- 소프트 삭제 정책 (`deleted_at`, `deleted_by`, `status`)
- 관리자 초기 부트스트랩 1회 자동 승격
- `GET /api/health` 환경변수/런타임 헬스체크

## 📊 기술 스택

- `Next.js 16` (App Router, Route Handlers)
- `React 19`
- `TypeScript`
- `Supabase` (Auth + Postgres + RLS + RPC)
- `Zod` (입력 검증)
- `Vitest` (단위 테스트)
- `Netlify` + `@netlify/plugin-nextjs`

## 📋 프로젝트 구조

```text
.
├── src/
│   ├── app/
│   │   ├── api/                 # 공개/관리자 API
│   │   ├── admin/               # 관리자 화면
│   │   ├── b/[slug]/            # 보드 목록/작성
│   │   ├── p/[postId]/          # 글 상세
│   │   ├── search/              # 통합 검색
│   │   ├── login/, signup/      # 인증 화면
│   │   └── page.tsx             # 홈
│   ├── components/              # AuthProvider, TopNav
│   ├── lib/
│   │   ├── api/                 # auth/rate-limit/errors/utils
│   │   └── supabase/            # browser/server client
│   └── types/                   # domain, zod schemas
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── scripts/
│   └── sync-local-supabase-env.sh
├── netlify.toml
└── docs/
```

## 🎨 화면 라우트

| 경로 | 설명 |
| --- | --- |
| `/` | 홈 (게시판 목록 + freeboard 최신글) |
| `/signup` | 회원가입 |
| `/login` | 로그인 |
| `/search` | 통합 검색 결과 |
| `/b/[slug]` | 보드 글 목록/검색 |
| `/b/[slug]/write` | 글 작성 |
| `/p/[postId]` | 글 상세 + 댓글 트리 |
| `/admin` | 관리자 대시보드 |
| `/admin/boards` | 게시판 생성/복제 |
| `/admin/users` | 유저 관리 |
| `/admin/reports` | 신고 관리 |

## 🧠 API 라우트

모든 응답은 기본적으로 아래 포맷을 사용합니다.

```json
{ "ok": true, "data": { } }
```

```json
{ "ok": false, "error": { "message": "..." } }
```

인증이 필요한 API는 `Authorization: Bearer <access_token>` 헤더를 사용합니다.

### Public API

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/api/health` | 헬스체크 (환경변수 검증 포함) |
| `POST` | `/api/auth/signup` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `GET` | `/api/me` | 내 프로필 조회 |
| `GET` | `/api/boards` | 게시판 목록 |
| `GET` | `/api/boards/[slug]/posts` | 게시글 목록/검색/페이지네이션(20) |
| `POST` | `/api/boards/[slug]/posts` | 게시글 작성 |
| `GET` | `/api/posts/[postId]` | 게시글 상세 + 댓글 트리 |
| `PATCH` | `/api/posts/[postId]` | 게시글 수정 |
| `DELETE` | `/api/posts/[postId]` | 게시글 소프트 삭제 |
| `POST` | `/api/posts/[postId]/comments` | 댓글/대댓글 작성 |
| `PATCH` | `/api/comments/[commentId]` | 댓글 수정 |
| `DELETE` | `/api/comments/[commentId]` | 댓글 소프트 삭제 |
| `POST` | `/api/posts/[postId]/like` | 좋아요 토글 |
| `POST` | `/api/reports` | 신고 생성 |
| `GET` | `/api/search` | 통합 검색(FTS) |

### Admin API

| Method | Path | 설명 |
| --- | --- | --- |
| `POST` | `/api/admin/boards/create` | 게시판 생성 |
| `POST` | `/api/admin/boards/clone` | 게시판/템플릿 기반 복제 |
| `GET` | `/api/admin/users` | 유저 목록/검색 |
| `PATCH` | `/api/admin/users/[userId]/role` | 권한 변경 |
| `PATCH` | `/api/admin/users/[userId]/suspend` | 정지 |
| `PATCH` | `/api/admin/users/[userId]/restore` | 정지 해제 |
| `GET` | `/api/admin/users/[userId]/activity` | 유저 활동 조회 |
| `PATCH` | `/api/admin/moderation/posts/[postId]` | 게시글 모더레이션 |
| `PATCH` | `/api/admin/moderation/comments/[commentId]` | 댓글 모더레이션 |
| `GET` | `/api/admin/reports` | 신고 목록 조회 |
| `PATCH` | `/api/admin/reports` | 신고 처리(`resolved/rejected`) |

## 🐳 데이터베이스 설계

마이그레이션 파일:

- `supabase/migrations/202602170001_init_freeboard.sql`
- `supabase/migrations/202602170002_add_global_search_rpc.sql`
- `supabase/migrations/202602170003_fix_search_prefix_matching.sql`
- `supabase/migrations/202602170004_toggle_post_like_rpc.sql`
- `supabase/migrations/202602170005_admin_profiles_safe_search.sql`
- `supabase/migrations/202602170006_harden_rpc_execute_permissions.sql`

핵심 테이블:

| 테이블 | 용도 |
| --- | --- |
| `profiles` | 사용자 프로필/역할/정지 정보 |
| `boards` | 게시판 설정/가시성/작성 정책 |
| `board_templates` | 게시판 템플릿 저장 |
| `posts` | 게시글 + `search_tsv` |
| `comments` | 댓글/대댓글(1단계) |
| `post_likes` | 게시글 좋아요 |
| `reports` | 신고 |
| `moderation_actions` | 관리자 조치 감사 로그 |
| `rate_limits` | 액션별 제한 카운터 |
| `app_settings` | 앱 설정/부트스트랩 플래그 |

적용 요소:

- `search_tsv` GIN 인덱스
- `posts/comments` 카운터 갱신 트리거
- 댓글 depth(1단계) 강제 트리거
- `consume_rate_limit` RPC
- 모든 핵심 테이블 RLS 활성화 + 정책 적용

## 통합 검색 FTS

`/api/search`는 `search_posts_fts` RPC를 호출합니다.

- 파서: Postgres `simple`
- 질의: `websearch_to_tsquery` + prefix `to_tsquery(...:*)` 병행
- 정렬: 관련도(rank) + 최신성 보정
- 일반 사용자: 공개 보드 + `published`만 노출
- 관리자: `published/hidden/pending/deleted` 전체 조회 가능
- 페이지 크기: `20` 고정

예시:

```bash
curl "http://127.0.0.1:3000/api/search?q=사이버&page=1"
```

## 로컬 실행 (Supabase Local Stack)

### 사전 요구사항

- Node.js 20+
- npm
- Docker Desktop (daemon 실행 상태)

### 빠른 시작

```bash
npm install
npm run local:up
npm run db:local:reset
npm run dev
```

헬스체크:

```bash
curl http://127.0.0.1:3000/api/health
```

정상 응답 예시:

```json
{"ok":true,"data":{"status":"ok","timestamp":"..."}}
```

### 로컬 관리자 부트스트랩 (1회)

1. `/signup`에서 `admin@local.test`로 가입
2. 로그인 시 자동 admin 승격
3. `/admin` 진입 후 관리자 기능 사용

### 종료

```bash
npm run db:local:status
npm run local:down
```

## 환경변수

`.env.local`은 `npm run env:local:sync`로 자동 갱신됩니다.

| 변수명 | 설명 | 기본값 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | 자동 주입 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저용 anon key | 자동 주입 |
| `NEXT_PUBLIC_SITE_URL` | canonical/sitemap 기준 URL | `http://127.0.0.1:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 key | 자동 주입 |
| `ADMIN_BOOTSTRAP_EMAIL` | 초기 관리자 이메일 | `admin@local.test` |
| `RATE_LIMIT_WINDOW_SECONDS` | 레이트리밋 윈도우 | `60` |
| `RATE_LIMIT_MAX_SIGNUP` | 가입 제한 | `5` |
| `RATE_LIMIT_MAX_LOGIN` | 로그인 제한 | `10` |
| `RATE_LIMIT_MAX_POST` | 게시글 작성 제한 | `10` |
| `RATE_LIMIT_MAX_COMMENT` | 댓글 작성 제한 | `20` |
| `RATE_LIMIT_MAX_REPORT` | 신고 제한 | `10` |

## 스크립트

```bash
# app
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:unit
npm run test:integration
npm run test:all

# local supabase
npm run db:local:start
npm run db:local:stop
npm run db:local:status
npm run db:local:reset
npm run env:local:sync
npm run local:up
npm run local:down
```

참고:

- `db:local:start`는 로컬 개발 가속을 위해 일부 Supabase 서비스(studio/realtime/storage 등)를 제외하고 기동합니다.
- `supabase/seed.sql`은 현재 의도적으로 비어 있습니다.

## 테스트

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

통합 테스트는 로컬 Supabase가 실행 중이고 아래 플래그를 준 경우에만 동작합니다.

```bash
RUN_SUPABASE_INTEGRATION_TESTS=1 npm run test:integration
```

## Netlify 배포

`netlify.toml`이 포함되어 있으며 Next.js 플러그인 기반 배포를 사용합니다.

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

배포 시 필수 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_SIGNUP`
- `RATE_LIMIT_MAX_LOGIN`
- `RATE_LIMIT_MAX_POST`
- `RATE_LIMIT_MAX_COMMENT`
- `RATE_LIMIT_MAX_REPORT`

프로덕션에서는 Supabase Cloud 프로젝트 값을 사용하면 됩니다.

## 운영 메모

- 댓글 대댓글은 1단계만 허용됩니다.
- 삭제는 소프트 삭제 우선입니다.
- 모바일 터치 영역은 주요 입력/버튼에 대해 44px 기준으로 폴리싱되어 있습니다.
- 홈 화면 최신글은 현재 `freeboard` 기준으로 표시됩니다.
- 로그인 레이트리밋은 `RATE_LIMIT_MAX_LOGIN`으로 별도 제어합니다.
- Core Web Vitals(INP/LCP/CLS)는 `/api/metrics/web-vitals`로 수집 포인트를 제공합니다.

---

문서/설계 참고:

- `docs/PLAN.md`
- `docs/PLAN_LOCAL.md`
- `docs/walkthrough.md`
