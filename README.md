# FreeBoard MVP

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)](https://www.netlify.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Next.js + Supabase 기반 자유 게시판 MVP입니다.

- 회원가입/로그인
- 다중 게시판 (`/b/[slug]`)
- 게시글/댓글(대댓글 1단계)/좋아요/신고
- 관리자 기능(보드 생성/복제, 유저 관리, 모더레이션)
- 통합 검색(FTS)
- 로컬 Supabase 스택 기반 테스트/개발

## 최근 구현 업데이트 (2026-02-17)

### Wave 1 완료 (보안/정확성)

1. 관리자 유저 검색 입력 안전화
- 적용: `src/app/api/admin/users/route.ts`
- 신규 유틸: `src/lib/api/admin-search.ts`
- 변경: 검색어에서 필터 제어문자 제거 + `%`, `_` 와일드카드 이스케이프
- 테스트: `src/lib/api/admin-search.test.ts`

2. 좋아요 토글 원자 처리(Race Condition 완화)
- 적용: `src/app/api/posts/[postId]/like/route.ts`
- 신규 DB RPC: `public.toggle_post_like`
- 마이그레이션: `supabase/migrations/202602170004_add_toggle_post_like_rpc.sql`
- 변경: 기존 `SELECT -> DELETE/INSERT` 패턴을 RPC 호출로 변경

3. 로그인 레이트리밋 분리
- 적용: `src/lib/env.ts`, `src/lib/api/rate-limit.ts`
- 환경변수 추가: `RATE_LIMIT_MAX_LOGIN`
- 동기화 스크립트 반영: `scripts/sync-local-supabase-env.sh`
- 샘플 env 반영: `.env.example`
- 테스트: `src/lib/env.test.ts`

## 목차

- [핵심 기능](#핵심-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [화면 라우트](#화면-라우트)
- [API 라우트](#api-라우트)
- [DB 및 마이그레이션](#db-및-마이그레이션)
- [검색(FTS)](#검색fts)
- [로컬 실행 (Supabase Local)](#로컬-실행-supabase-local)
- [환경변수](#환경변수)
- [스크립트](#스크립트)
- [테스트](#테스트)
- [Netlify 배포](#netlify-배포)
- [문서](#문서)

## 핵심 기능

### 사용자 기능

- 이메일/비밀번호 회원가입, 로그인 (`/signup`, `/login`)
- 이메일 인증 비활성화(로컬 설정)
- 보드 목록/진입/검색 (`/b/[slug]`)
- 글 작성/수정/소프트 삭제
- 댓글/대댓글(1단계) 작성/수정/소프트 삭제
- 좋아요 토글
- 게시글/댓글 신고
- 통합 검색 (`/search`)

### 관리자 기능

- 관리자 대시보드 (`/admin`)
- 게시판 생성/복제 (`/admin/boards`)
- 유저 목록/검색/권한 변경/정지/복구/활동 조회 (`/admin/users`)
- 신고 목록 조회/처리 (`/admin/reports`)
- 게시글/댓글 모더레이션 (`published`, `hidden`, `deleted`)
- 모더레이션 감사 로그 저장 (`moderation_actions`)

### 운영/정책

- RLS(Row Level Security) 적용
- 정지 유저 쓰기 제한
- IP + 계정 기반 레이트리밋 (`consume_rate_limit`)
- 관리자 부트스트랩 1회 자동 승격
- `/api/health` 헬스체크 제공

## 기술 스택

- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase (Auth + Postgres + RLS + RPC)
- Zod (요청 검증)
- Vitest
- Netlify + `@netlify/plugin-nextjs`

## 프로젝트 구조

```text
.
├── src/
│   ├── app/
│   │   ├── api/                 # 공개/관리자 API
│   │   ├── admin/               # 관리자 화면
│   │   ├── b/[slug]/            # 보드 목록/작성
│   │   ├── p/[postId]/          # 글 상세
│   │   ├── search/              # 통합 검색
│   │   ├── login/, signup/
│   │   └── page.tsx             # 홈
│   ├── components/              # AuthProvider, TopNav
│   ├── lib/
│   │   ├── api/                 # auth/rate-limit/errors/search 유틸
│   │   └── supabase/            # browser/server client
│   └── types/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── scripts/
│   └── sync-local-supabase-env.sh
├── netlify.toml
└── docs/
```

## 화면 라우트

| 경로 | 설명 |
| --- | --- |
| `/` | 홈 (보드 목록 + freeboard 최신글) |
| `/signup` | 회원가입 |
| `/login` | 로그인 |
| `/search` | 통합 검색 |
| `/b/[slug]` | 보드 글 목록/검색 |
| `/b/[slug]/write` | 글 작성 |
| `/p/[postId]` | 글 상세 + 댓글 트리 |
| `/admin` | 관리자 대시보드 |
| `/admin/boards` | 게시판 생성/복제 |
| `/admin/users` | 유저 관리 |
| `/admin/reports` | 신고 처리 |

## API 라우트

응답 포맷:

```json
{ "ok": true, "data": {} }
```

```json
{ "ok": false, "error": { "message": "..." } }
```

인증 필요 API는 `Authorization: Bearer <access_token>` 헤더를 사용합니다.

### Public API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/boards`
- `GET /api/boards/[slug]/posts`
- `POST /api/boards/[slug]/posts`
- `GET /api/posts/[postId]`
- `PATCH /api/posts/[postId]`
- `DELETE /api/posts/[postId]`
- `POST /api/posts/[postId]/comments`
- `PATCH /api/comments/[commentId]`
- `DELETE /api/comments/[commentId]`
- `POST /api/posts/[postId]/like`
- `POST /api/reports`
- `GET /api/search`

### Admin API

- `POST /api/admin/boards/create`
- `POST /api/admin/boards/clone`
- `GET /api/admin/users`
- `PATCH /api/admin/users/[userId]/role`
- `PATCH /api/admin/users/[userId]/suspend`
- `PATCH /api/admin/users/[userId]/restore`
- `GET /api/admin/users/[userId]/activity`
- `PATCH /api/admin/moderation/posts/[postId]`
- `PATCH /api/admin/moderation/comments/[commentId]`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports`

## DB 및 마이그레이션

마이그레이션 목록:

- `supabase/migrations/202602170001_init_freeboard.sql`
- `supabase/migrations/202602170002_add_global_search_rpc.sql`
- `supabase/migrations/202602170003_fix_search_prefix_matching.sql`
- `supabase/migrations/202602170004_add_toggle_post_like_rpc.sql`

핵심 테이블:

- `profiles`
- `boards`
- `board_templates`
- `posts`
- `comments`
- `post_likes`
- `reports`
- `moderation_actions`
- `rate_limits`
- `app_settings`

핵심 함수/트리거:

- `consume_rate_limit`
- `search_posts_fts`
- `toggle_post_like`
- `update_post_search_tsv` + `trigger_posts_search_tsv`
- `handle_new_user_profile`
- 댓글 depth 강제 트리거

## 검색(FTS)

`/api/search`는 `search_posts_fts` RPC를 호출합니다.

- 파서: `simple`
- 질의: `websearch_to_tsquery` + prefix tsquery (`...:*`)
- 정렬: rank + 최신성 보정
- 일반 사용자: 공개 보드 + `published`
- 관리자: `published/hidden/pending/deleted`
- 페이지 크기: 20

예시:

```bash
curl "http://127.0.0.1:3000/api/search?q=사이버&page=1"
```

## 로컬 실행 (Supabase Local)

사전 요구사항:

- Node.js 20+
- npm
- Docker Desktop

빠른 시작:

```bash
npm install
npm run local:up
npm run db:local:reset
npm run dev
```

상태 확인:

```bash
curl http://127.0.0.1:3000/api/health
```

로컬 관리자 부트스트랩:

1. `/signup`에서 `admin@local.test` 가입
2. 로그인 시 자동 admin 승격
3. `/admin`에서 관리자 기능 사용

종료:

```bash
npm run db:local:status
npm run local:down
```

## 환경변수

`.env.local`은 `npm run env:local:sync`로 자동 동기화됩니다.

| 변수명 | 설명 | 기본값 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | 자동 주입 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 anon key | 자동 주입 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 key | 자동 주입 |
| `ADMIN_BOOTSTRAP_EMAIL` | 초기 관리자 이메일 | `admin@local.test` |
| `RATE_LIMIT_WINDOW_SECONDS` | 레이트리밋 윈도우 | `60` |
| `RATE_LIMIT_MAX_SIGNUP` | 가입 제한 | `5` |
| `RATE_LIMIT_MAX_LOGIN` | 로그인 제한 | `10` |
| `RATE_LIMIT_MAX_POST` | 글 작성 제한 | `10` |
| `RATE_LIMIT_MAX_COMMENT` | 댓글 제한 | `20` |
| `RATE_LIMIT_MAX_REPORT` | 신고 제한 | `10` |

## 스크립트

```bash
# app
npm run dev
npm run build
npm run start
npm run lint
npm run test

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

- `db:local:start`는 일부 서비스(studio/realtime/storage 등)를 제외하고 실행
- `supabase/seed.sql`은 현재 비어 있음

## 테스트

기본 회귀:

```bash
npm run lint
npm run test
npm run build
```

현재 테스트 파일:

- `src/lib/api/slug.test.ts`
- `src/lib/api/netlify.test.ts`
- `src/lib/api/admin-search.test.ts`
- `src/lib/env.test.ts`

Wave 1 구현 시 자체 테스트 결과:

- 관리자 검색 필터 안전화 테스트 통과
- `toggle_post_like` RPC 순차/병렬 호출 일관성 확인
- login rate-limit 환경변수 분리 동작 확인

## Netlify 배포

`netlify.toml` 포함 (Next.js plugin 기반):

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

필수 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_SIGNUP`
- `RATE_LIMIT_MAX_LOGIN`
- `RATE_LIMIT_MAX_POST`
- `RATE_LIMIT_MAX_COMMENT`
- `RATE_LIMIT_MAX_REPORT`

## 문서

- `docs/PLAN.md`
- `docs/PLAN_LOCAL.md`
- `docs/walkthrough.md` (체크리스트 + 진행 상태)

