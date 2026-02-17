# FreeBoard (Next.js + Supabase + Netlify)

자유 게시판 서비스 구현체입니다.

- 회원가입/로그인 (Supabase Auth)
- 다중 게시판 (`/b/[slug]`)
- 게시글/댓글(대댓글 1단계)/좋아요/신고
- 관리자 모드 (게시판 생성/복제, 유저 role/정지/복구/활동조회, 신고 처리, 모더레이션)
- 소프트 삭제, FTS 검색, 레이트리밋, 관리자 초기 부트스트랩

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (Auth + Postgres + RLS)
- Netlify (`@netlify/plugin-nextjs`)
- Vitest

## 로컬 전용 테스트 (Cloud Supabase 불필요)

이 프로젝트는 Docker + Supabase CLI 로컬 스택으로 테스트합니다.

### 1) 설치

```bash
npm install
```

### 2) 로컬 Supabase 기동 + env 자동 동기화

```bash
npm run local:up
```

이 명령은 다음을 수행합니다.

- `npx supabase start`
- `scripts/sync-local-supabase-env.sh` 실행
- `.env.local` 자동 갱신
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_BOOTSTRAP_EMAIL` (없으면 `admin@local.test`)
  - rate-limit 관련 키 (기존 값 유지, 없으면 기본값)

### 3) DB 리셋/마이그레이션 적용 (최초 1회 또는 스키마 변경 시)

```bash
npm run db:local:reset
```

### 4) 앱 실행

```bash
npm run dev
```

### 5) 상태 확인

```bash
curl http://localhost:3000/api/health
```

정상이면 `{"ok":true,...}` 형태가 반환됩니다.

### 6) 로컬 관리자 부트스트랩 시나리오

1. `/signup`에서 `admin@local.test`로 회원가입
2. 로그인 후 `GET /api/me` 또는 상단 role 표시에서 `admin` 확인
3. `/admin/boards`에서 게시판 생성/복제 테스트

### 종료/상태 확인

```bash
npm run db:local:status
npm run local:down
```

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build

npm run db:local:start
npm run db:local:stop
npm run db:local:status
npm run db:local:reset
npm run env:local:sync
npm run local:up
npm run local:down
```

## 주요 API

### Public

- `GET /api/boards`
- `GET /api/boards/{slug}/posts?page=1&q=...`
- `POST /api/boards/{slug}/posts`
- `GET /api/posts/{postId}`
- `PATCH /api/posts/{postId}`
- `DELETE /api/posts/{postId}`
- `POST /api/posts/{postId}/comments`
- `PATCH /api/comments/{commentId}`
- `DELETE /api/comments/{commentId}`
- `POST /api/posts/{postId}/like`
- `POST /api/reports`
- `GET /api/me`

### Admin

- `POST /api/admin/boards/create`
- `POST /api/admin/boards/clone`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{userId}/role`
- `PATCH /api/admin/users/{userId}/suspend`
- `PATCH /api/admin/users/{userId}/restore`
- `GET /api/admin/users/{userId}/activity`
- `PATCH /api/admin/moderation/posts/{postId}`
- `PATCH /api/admin/moderation/comments/{commentId}`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports`

## 관리자 부트스트랩

로그인 시 다음 조건을 만족하면 1회만 자동 admin 승격됩니다.

- 로그인 유저 이메일 == `ADMIN_BOOTSTRAP_EMAIL`
- `app_settings.bootstrap_admin_assigned` 미설정

## Netlify 배포

1. 저장소 연결
2. Build command: `npm run build`
3. 환경변수 등록 (`.env.example` 기준)
4. 배포

`netlify.toml`에 Next.js plugin 설정이 포함되어 있습니다.
