## 자유 게시판 (Next.js + Supabase + Netlify) 구현 계획 v1

### 요약
- 목표: `회원가입/로그인`, `자유 게시판`, `관리자 모드(게시판 무한 생성·복제 + 유저 관리)`를 갖춘 서비스 구축
- 기술: `Next.js 15(App Router, TypeScript)` + `Supabase(Auth + Postgres + RLS)` + `Netlify(Functions 배포)`
- 확정 요구:
  - 가입: 이메일 인증 없이 즉시 가입
  - 게시판 구조: `/b/{boardSlug}` 동적 라우팅
  - 게시판 복제: 카테고리(게시판) 템플릿 복제 방식
  - 기능 범위: MVP+운영필수(글/댓글/대댓글/좋아요/검색/신고/공지·고정/관리자 모더레이션)
  - 유저 관리: 역할 변경 + 정지/복구 + 활동 조회
  - 권한: `user/admin` 2단계
  - 삭제 정책: 소프트 삭제
  - 목록: 20개 페이지네이션
  - 검색: Postgres FTS
  - 스팸 방어: IP+계정 레이트리밋
  - 관리자 초기 부트스트랩: 환경변수 이메일 1회 승격

---

## 1) 구현 구조(결정 완료)

### 1.1 프로젝트 구조
- 루트 단일 앱(모노레포 아님)
- 주요 디렉토리
  - `src/app` : App Router 페이지
  - `src/app/api` : Route Handlers (Netlify Functions로 동작)
  - `src/lib/supabase` : client/server/admin 클라이언트 분리
  - `src/lib/auth` : 권한 체크 유틸
  - `src/lib/rate-limit` : 레이트리밋 유틸
  - `src/types` : API DTO 및 DB 타입
  - `supabase/migrations` : SQL 마이그레이션
  - `netlify.toml` : 빌드/런타임 설정

### 1.2 런타임 정책
- 브라우저: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 사용
- 관리자/민감 작업: 서버 Route Handler에서만 수행 (`SUPABASE_SERVICE_ROLE_KEY`)
- 관리자 기능(유저 role/suspend, 게시판 템플릿 복제)은 전부 서버 엔드포인트 경유

### 1.3 권한/역할
- 역할: `user`, `admin`
- Admin 체크: `profiles.role = 'admin'`
- 정지 체크: `profiles.suspended_until > now()`이면 글/댓글/좋아요/신고 생성 불가

---

## 2) 데이터 모델(결정 완료)

### 2.1 테이블
1. `profiles`
- `id uuid pk` (auth.users.id FK)
- `email text unique`
- `nickname text unique`
- `role text check ('user','admin') default 'user'`
- `suspended_until timestamptz null`
- `suspend_reason text null`
- `created_at`, `updated_at`

2. `boards`
- `id uuid pk`
- `slug text unique`
- `name text`
- `description text`
- `is_public boolean default true`
- `allow_post boolean default true`
- `allow_comment boolean default true`
- `require_post_approval boolean default false`
- `created_by uuid` (profiles.id)
- `created_at`, `updated_at`
- `deleted_at timestamptz null` (보드도 소프트 삭제 가능)

3. `board_templates`
- `id uuid pk`
- `name text`
- `settings jsonb` (boards 생성 기본값)
- `created_by uuid`
- `created_at`

4. `posts`
- `id uuid pk`
- `board_id uuid fk`
- `author_id uuid fk`
- `title text`
- `content text`
- `status text check ('published','hidden','pending','deleted') default 'published'`
- `is_notice boolean default false`
- `is_pinned boolean default false`
- `like_count int default 0`
- `comment_count int default 0`
- `search_tsv tsvector` (title/content FTS)
- `created_at`, `updated_at`
- `deleted_at`, `deleted_by uuid null`

5. `comments`
- `id uuid pk`
- `post_id uuid fk`
- `author_id uuid fk`
- `parent_id uuid null fk comments.id` (대댓글 1단계만 허용)
- `content text`
- `status text check ('published','hidden','deleted') default 'published'`
- `created_at`, `updated_at`
- `deleted_at`, `deleted_by uuid null`

6. `post_likes`
- `post_id uuid fk`
- `user_id uuid fk`
- `created_at`
- PK(`post_id`,`user_id`)

7. `reports`
- `id uuid pk`
- `target_type text check ('post','comment')`
- `target_id uuid`
- `reporter_id uuid fk`
- `reason text`
- `status text check ('open','resolved','rejected') default 'open'`
- `created_at`, `resolved_at`, `resolved_by uuid null`

8. `moderation_actions`
- `id uuid pk`
- `admin_id uuid fk`
- `action_type text` (hide_post, delete_comment, suspend_user 등)
- `target_type text`
- `target_id uuid`
- `meta jsonb`
- `created_at`

9. `rate_limits`
- `id bigserial pk`
- `action text` (signup, login, create_post, create_comment, report)
- `actor_key text` (user_id or hashed_ip)
- `window_start timestamptz`
- `count int`
- unique(`action`,`actor_key`,`window_start`)

10. `app_settings`
- `key text pk`
- `value jsonb`
- 관리자 부트스트랩 1회 플래그 저장 (`bootstrap_admin_assigned`)

### 2.2 인덱스/제약
- `posts(board_id, created_at desc)`
- `posts(search_tsv)` GIN
- `comments(post_id, created_at asc)`
- `reports(status, created_at desc)`
- `profiles(role, suspended_until)`
- 대댓글 depth는 DB 제약 + 서비스 로직으로 `parent.parent_id is null` 강제

### 2.3 RLS 정책
- 기본: 전 테이블 RLS ON
- 읽기: 공개 게시판의 `published`/`notice`/`pinned`만 공개
- 쓰기: 로그인 사용자만, 본인 작성분만 수정/삭제 가능
- 관리자: 정책에서 `profiles.role='admin'`이면 전체 모더레이션 가능
- `service_role`은 서버 전용(클라이언트 노출 금지)

---

## 3) API/인터페이스 변경 사항(중요)

### 3.1 공개 API
1. `GET /api/boards`
- 보드 목록 조회

2. `POST /api/boards/{slug}/posts`
- 게시글 작성 (정지/레이트리밋 검사)

3. `GET /api/boards/{slug}/posts?page=1&q=...`
- 목록 + FTS 검색 + 페이지네이션(20)

4. `GET /api/posts/{postId}`
- 글 상세(댓글 트리 포함)

5. `PATCH /api/posts/{postId}`
- 본인 글 수정(관리자 예외)

6. `DELETE /api/posts/{postId}`
- 소프트 삭제

7. `POST /api/posts/{postId}/comments`
- 댓글/대댓글 작성

8. `PATCH /api/comments/{commentId}`
- 본인 댓글 수정(관리자 예외)

9. `DELETE /api/comments/{commentId}`
- 소프트 삭제

10. `POST /api/posts/{postId}/like`
- 좋아요 토글

11. `POST /api/reports`
- 게시글/댓글 신고

### 3.2 관리자 API
1. `POST /api/admin/boards/create`
- 직접 생성

2. `POST /api/admin/boards/clone`
- 템플릿 기반 복제
- slug 충돌 시 `-2`, `-3` suffix 자동 부여
- 복제 상한 없음(요청당 1개 생성, 반복 호출로 무한 생성)

3. `GET /api/admin/users`
- 유저 목록/검색/필터

4. `PATCH /api/admin/users/{userId}/role`
- `user↔admin` 변경

5. `PATCH /api/admin/users/{userId}/suspend`
- 정지(기간/사유)

6. `PATCH /api/admin/users/{userId}/restore`
- 정지 해제

7. `GET /api/admin/users/{userId}/activity`
- 게시글/댓글/신고/모더레이션 이력 조회

8. `PATCH /api/admin/moderation/posts/{postId}`
- 숨김/복구/삭제 상태 전환

9. `PATCH /api/admin/moderation/comments/{commentId}`
- 숨김/복구/삭제 상태 전환

### 3.3 인증 플로우
- 가입/로그인/로그아웃은 Supabase Auth JS 사용
- 로그인 직후 서버에서 관리자 부트스트랩 체크:
  - `ADMIN_BOOTSTRAP_EMAIL`과 auth user email 일치
  - `app_settings.bootstrap_admin_assigned != true`
  - 조건 충족 시 해당 유저 `admin` 승격 + 플래그 true

---

## 4) 화면/라우팅(결정 완료)
- `/` : 최신 글 피드 + 보드 바로가기
- `/signup`, `/login`
- `/b/[slug]` : 게시판 목록
- `/b/[slug]/write`
- `/p/[postId]` : 글 상세 + 댓글
- `/admin` : 대시보드
- `/admin/boards` : 생성/복제
- `/admin/users` : 유저 관리
- `/admin/reports` : 신고 처리

---

## 5) Netlify 배포 설계(결정 완료)
- `netlify.toml`
  - Next.js 빌드 설정 + plugin 사용
- 환경변수
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_BOOTSTRAP_EMAIL`
  - `RATE_LIMIT_WINDOW_SECONDS`
  - `RATE_LIMIT_MAX_SIGNUP`, `RATE_LIMIT_MAX_POST`, `RATE_LIMIT_MAX_COMMENT`, `RATE_LIMIT_MAX_REPORT`
- IP 추출 우선순위
  - `x-nf-client-connection-ip` -> `x-forwarded-for` 첫 값
- 관리자 엔드포인트는 반드시 서버에서 service role 클라이언트 생성

---

## 6) 테스트 케이스/시나리오(완료 기준)

### 6.1 인증/권한
1. 일반 유저 가입/로그인 성공
2. 이메일 인증 없이 즉시 로그인 가능
3. 관리자 부트스트랩 1회만 적용
4. 정지 유저는 글/댓글/좋아요/신고 생성 실패(403)

### 6.2 게시판/콘텐츠
1. 보드 생성 후 `/b/{slug}` 접근 가능
2. 보드 복제 시 설정 복제 및 slug 자동 중복해결
3. 글 작성/수정/소프트삭제 정상
4. 댓글/대댓글(1단계) 작성/수정/소프트삭제 정상
5. 좋아요 토글 idempotent 동작
6. 공지/고정 게시물 상단 노출
7. FTS 검색 정확도(제목/본문) 및 페이지네이션 20개 검증

### 6.3 모더레이션/신고
1. 신고 생성 -> 관리자 목록에서 조회 가능
2. 관리자 숨김/복구/삭제 조치 반영
3. moderation_actions 감사 로그 누락 없음

### 6.4 레이트리밋
1. signup/post/comment/report 임계치 초과 시 429
2. window 경과 후 요청 정상 복구
3. user_id 기반 + 비로그인 시 IP 기반 키 동작

### 6.5 배포
1. Netlify preview 배포 성공
2. production 배포 후 SSR/Route Handler 정상 동작
3. 환경변수 누락 시 헬스체크에서 명확한 오류 반환

---

## 7) 구현 순서(작업 분해)
1. Next.js 초기 세팅 + Netlify 설정
2. Supabase 스키마/마이그레이션 + RLS 정책
3. 인증/세션 공통 모듈
4. 공개 API(보드/글/댓글/좋아요/신고)
5. 관리자 API(보드 생성·복제, 유저관리, 모더레이션)
6. 화면 구현(사용자/관리자)
7. 레이트리밋/에러 핸들링/로깅
8. 테스트(E2E+API)
9. Netlify 배포 검증 및 운영 체크리스트 문서화

---

## 8) 가정 및 기본값(명시)
- 첨부파일/알림/북마크는 1차 범위에서 제외
- 대댓글은 1단계만 허용
- 보드 권한은 전체 공개 기준(비공개 보드는 이후 확장)
- 삭제는 전부 소프트 삭제 우선
- 관리자 외 별도 moderator 역할은 도입하지 않음
- 검색은 한국어 형태소 엔진 없이 Postgres FTS 기본 구성을 우선 적용

---

## 9) 웹 검증 근거(참고 링크)
- Netlify Next.js 런타임/배포: https://docs.netlify.com/frameworks/next-js/overview/
- Netlify Functions 개요: https://docs.netlify.com/build/functions/overview/
- Supabase Auth 관리 API(서버 전용): https://supabase.com/docs/reference/javascript/auth-admin-listusers
- Supabase User Management(관리형 사용자 작업): https://supabase.com/docs/guides/auth/user-management
- Supabase RLS 가이드: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase 전문 검색(FTS): https://supabase.com/docs/guides/database/full-text-search
- 포럼 기본 기능 참고(카테고리/토픽/모더레이션 개념): https://docs.discourse.org/ და https://invisioncommunity.com/features/forums/
