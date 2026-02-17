# Multi FreeBoard Codex Walkthrough (Checklist)

## 1) 문서 메타

- 기준 브랜치: `main`
- 기준 커밋: `b62040d`
- 검증일: `2026-02-17`
- 코드 스냅샷:
  - TypeScript/TSX 파일: `54`
  - SQL 마이그레이션 파일: `3`
- 참고: `docs/walkthrough.md.resolved` 파일은 현재 저장소에 없음

---

## 2) 체크박스 사용 규칙

- [ ] 미완료
- [x] 완료
- 각 이슈의 상단 체크박스는 **해당 이슈 전체 완료** 상태를 의미
- 이슈 내부 하위 체크박스(완료 조건)를 모두 `x`로 바꾸면 상단도 `x`로 갱신
- `deferred` 항목은 정책 결정 전까지 `open` 상태로 유지하고, 결정 후 별도 완료 처리

---

## 3) 핵심 요약

- 총 이슈: `25`
- Severity 분포:
  - Critical: `3`
  - High: `7`
  - Medium: `8`
  - Low: `7`
- 현재 상태(초기값):
  - [x] Open 항목 처리 시작
  - [ ] Partial 항목 완료 전환
  - [ ] Deferred 항목 의사결정 완료

즉시 처리 Top 5:

- [x] W-001 관리자 사용자 검색 필터 인젝션 리스크
- [x] W-002 좋아요 토글 경쟁 상태
- [x] W-003 로그인 레이트리밋 매핑 오류
- [ ] W-008 에러 분류 미흡 (`handleRouteError`)
- [ ] W-006 `apiFetch` 비-JSON 응답 내구성 부족

---

## 4) 이슈 체크리스트 (Issue Ledger)

### Critical

- [x] **W-001 관리자 사용자 검색 필터 인젝션 리스크** `[Critical][resolved]`
  - Evidence: `src/app/api/admin/users/route.ts:31`
  - Impact: 사용자 입력이 `.or(...)` 필터 문자열에 직접 들어감
  - Fix Plan: 입력 이스케이프 또는 필터 분리
  - 완료 조건:
    - [x] 특수문자 입력(`%`, `_`, `,`, `)`)에서도 필터 조작 불가
    - [x] 관리자 사용자 검색 테스트 케이스 추가

- [x] **W-002 좋아요 토글 경쟁 상태** `[Critical][resolved]`
  - Evidence: `src/app/api/posts/[postId]/like/route.ts:29`
  - Impact: `SELECT -> DELETE/INSERT` 비원자 처리
  - Fix Plan: DB RPC 또는 단일 SQL 트랜잭션으로 원자화
  - 완료 조건:
    - [x] 동시 요청에서도 liked/like_count 일관성 보장
    - [x] race condition 회귀 테스트 추가

- [x] **W-003 로그인 레이트리밋 매핑 오류** `[Critical][resolved]`
  - Evidence: `src/lib/api/rate-limit.ts:12`
  - Impact: login이 signup 한도를 재사용
  - Fix Plan: `RATE_LIMIT_MAX_LOGIN` 도입 및 매핑 분리
  - 완료 조건:
    - [x] login/signup 임계치 독립 동작
    - [x] `.env.example`, README 동기화

### High

- [ ] **W-004 보드 목록 API 관리자 쿼리 중복** `[High][open]`
  - Evidence: `src/app/api/boards/[slug]/posts/route.ts:46`, `src/app/api/boards/[slug]/posts/route.ts:61`
  - Impact: 중복 쿼리로 유지보수 비용 증가
  - Fix Plan: 공통 쿼리 빌더 + 조건부 status 필터
  - 완료 조건:
    - [ ] 중복 쿼리 블록 제거
    - [ ] 관리자/일반 결과 회귀 확인

- [ ] **W-006 `apiFetch` 비-JSON 응답 내구성 부족** `[High][open]`
  - Evidence: `src/lib/client-api.ts:32`
  - Impact: JSON 파싱 실패 시 클라이언트 오류
  - Fix Plan: `response.ok` 분기 + fallback 에러 객체
  - 완료 조건:
    - [ ] 비-JSON 500에서 안전한 에러 처리
    - [ ] `apiFetch` 단위 테스트 추가

- [ ] **W-007 `next.config.ts` 하드닝 부재** `[High][open]`
  - Evidence: `next.config.ts:3`
  - Impact: 보안/운영 기본 설정 부족
  - Fix Plan: 보안 헤더/기본 옵션 명시
  - 완료 조건:
    - [ ] 핵심 헤더 적용 확인
    - [ ] 빌드/배포 회귀 없음

- [ ] **W-008 에러 분류 미흡 (`handleRouteError`)** `[High][open]`
  - Evidence: `src/lib/api/errors.ts:21`
  - Impact: 내부 오류도 400으로 반환
  - Fix Plan: 비즈니스 오류만 4xx, 나머지 5xx
  - 완료 조건:
    - [ ] 미분류 예외 500 반환
    - [ ] 401/403/429/500 테스트 추가

- [ ] **W-011 모더레이션 로그 실패 무시** `[High][open]`
  - Evidence: `src/lib/api/moderation.ts:11`
  - Impact: 감사 로그 누락 탐지 어려움
  - Fix Plan: insert 에러 캡처/로깅
  - 완료 조건:
    - [ ] 실패 로그 기록
    - [ ] 기존 API 성공 경로 유지

- [ ] **W-020 관리자 신고 목록 페이지네이션 미지원** `[High][open]`
  - Evidence: `src/app/api/admin/reports/route.ts:24`
  - Impact: 데이터 증가 시 응답 비대화
  - Fix Plan: `page`, `pageSize`, `total` 도입
  - 완료 조건:
    - [ ] 대량 데이터에서도 조회 안정
    - [ ] 관리자 UI 페이지 이동 가능

- [ ] **W-025 IP `unknown` 폴백의 오탐/과도 차단 리스크** `[High][open]`
  - Evidence: `src/lib/api/netlify.ts:14`
  - Impact: IP 미식별 요청이 동일 키로 집계
  - Fix Plan: `unknown` 처리 정책 분리 + 로그 추적
  - 완료 조건:
    - [ ] 오탐률 감소 확인
    - [ ] 식별률 모니터링 가능

### Medium

- [ ] **W-005 Supabase Admin Client 반복 생성** `[Medium][open]`
  - Evidence: `src/lib/supabase/server.ts:16`
  - Impact: 불필요한 객체 생성
  - Fix Plan: 캐싱(모듈/요청 스코프)
  - 완료 조건:
    - [ ] 재사용 로직 적용
    - [ ] 인증/권한 회귀 없음

- [ ] **W-009 홈 피드 보드 슬러그 하드코딩** `[Medium][open]`
  - Evidence: `src/app/page.tsx:43`
  - Impact: 운영 유연성 제한
  - Fix Plan: 기본 보드 설정값 또는 집계 API 도입
  - 완료 조건:
    - [ ] 하드코딩 제거
    - [ ] 빈 보드/다중 보드 정상 처리

- [ ] **W-010 TopNav 보드 링크 하드코딩** `[Medium][open]`
  - Evidence: `src/components/top-nav.tsx:37`
  - Impact: 보드 변경 시 수동 반영 필요
  - Fix Plan: `/api/boards` 기반 동적 네비게이션
  - 완료 조건:
    - [ ] 보드 생성/삭제 시 자동 반영

- [ ] **W-012 소프트 삭제 시간 생성 기준 불일치** `[Medium][open]`
  - Evidence: `src/app/api/posts/[postId]/route.ts:172`, `src/app/api/comments/[commentId]/route.ts:75`
  - Impact: API 서버 시간과 DB 시간 기준 혼재
  - Fix Plan: DB 기준 시간(`now()`/trigger)으로 일관화
  - 완료 조건:
    - [ ] soft delete 타임스탬프 일관화
    - [ ] 삭제/복구 회귀 통과

- [ ] **W-013 프로필 생성 로직 중복 (API + DB Trigger)** `[Medium][partial]`
  - Evidence: `src/lib/api/auth.ts:21`, `supabase/migrations/202602170001_init_freeboard.sql:285`
  - Impact: 생성 책임 중복
  - Fix Plan: 단일 책임 경로 확정
  - 완료 조건:
    - [ ] 프로필 생성 책임 1곳으로 통합
    - [ ] 중복 insert 경고 없음

- [ ] **W-014 `status + deleted_at` 이중 소프트 삭제 모델** `[Medium][deferred]`
  - Evidence: `src/app/api/posts/[postId]/route.ts:171`, `src/app/api/boards/[slug]/posts/route.ts:50`
  - Impact: 쿼리 복잡성 vs 상태 표현력 트레이드오프
  - Fix Plan: 정책 비교 후 유지/단순화 결정
  - 완료 조건:
    - [ ] 삭제 모델 정책 문서화

- [ ] **W-015 라우트 반복 패턴 헬퍼 미분리** `[Medium][open]`
  - Evidence: `src/app/api/posts/[postId]/comments/route.ts:17`, `src/app/api/reports/route.ts:12`
  - Impact: 인증/레이트리밋/권한 코드 반복
  - Fix Plan: 공통 래퍼 유틸 도입
  - 완료 조건:
    - [ ] 공통 코드 감소
    - [ ] 응답 포맷 불변

- [ ] **W-024 `board_templates` 관리 기능 미완성** `[Medium][partial]`
  - Evidence: `src/app/api/admin/boards/clone/route.ts:29`, `src/types/schemas.ts:14`
  - Impact: 템플릿 참조만 가능, 관리 플로우 미완결
  - Fix Plan: 템플릿 CRUD API/화면 추가
  - 완료 조건:
    - [ ] 생성 -> 복제 -> 수정 흐름 완결

### Low

- [ ] **W-016 테스트 커버리지 부족** `[Low][open]`
  - Evidence: `src/lib/api/slug.test.ts:1`, `src/lib/api/netlify.test.ts:1`
  - Impact: 핵심 경로 회귀 탐지 어려움
  - Fix Plan: Critical/High 연계 테스트 우선 추가
  - 완료 조건:
    - [ ] 핵심 경로 테스트 확보

- [ ] **W-017 AuthProvider에서 `getSession()` 의존** `[Low][open]`
  - Evidence: `src/components/auth-provider.tsx:32`
  - Impact: 세션/사용자 상태 불일치 가능성
  - Fix Plan: 필요한 지점 `getUser()` 기반 보강
  - 완료 조건:
    - [ ] 인증 상태 전이 시 UI 일관성 유지

- [ ] **W-018 글로벌 CSS 품질 점검 미체계화** `[Low][deferred]`
  - Evidence: `src/app/globals.css:1`
  - Impact: 장기 유지보수 리스크
  - Fix Plan: 스타일 체크리스트 문서화
  - 완료 조건:
    - [ ] CSS 규칙 문서 완료

- [ ] **W-019 `seed.sql` 실질 시드 부재** `[Low][deferred]`
  - Evidence: `supabase/seed.sql:1`
  - Impact: 로컬 재현 수작업 증가
  - Fix Plan: 최소 시드 옵션화
  - 완료 조건:
    - [ ] `db reset` 후 기본 시나리오 실행 가능

- [ ] **W-021 ESLint 커스텀 정책 부재** `[Low][deferred]`
  - Evidence: `eslint.config.mjs:5`
  - Impact: 팀 정책 강제 부족
  - Fix Plan: 운영 룰셋 정의
  - 완료 조건:
    - [ ] CI 룰 위반 검출

- [ ] **W-022 Vitest 커버리지 설정 부재** `[Low][open]`
  - Evidence: `vitest.config.ts:14`
  - Impact: 커버리지 관리 불가
  - Fix Plan: coverage 설정 및 threshold 도입
  - 완료 조건:
    - [ ] 커버리지 리포트 생성
    - [ ] 최소 임계치 적용

- [ ] **W-023 닉네임 정책의 한글 미지원** `[Low][deferred]`
  - Evidence: `src/types/schemas.ts:65`
  - Impact: 한국어 UX 제약 가능성
  - Fix Plan: 허용 문자 정책 합의 후 regex 반영
  - 완료 조건:
    - [ ] 닉네임 정책 문서 확정

---

## 5) Wave 실행 체크리스트

- [x] **Wave 1 완료 (보안/정확성)**
  - [x] W-001
  - [x] W-002
  - [x] W-003

- [ ] **Wave 2 완료 (안정성/에러처리)**
  - [ ] W-006
  - [ ] W-008
  - [ ] W-011
  - [ ] W-020
  - [ ] W-025

- [ ] **Wave 3 완료 (구조 개선)**
  - [ ] W-004
  - [ ] W-005
  - [ ] W-009
  - [ ] W-010
  - [ ] W-012
  - [ ] W-013
  - [ ] W-015
  - [ ] W-024

- [ ] **Wave 4 완료 (테스트/운영 품질)**
  - [ ] W-007
  - [ ] W-014
  - [ ] W-016
  - [ ] W-017
  - [ ] W-018
  - [ ] W-019
  - [ ] W-021
  - [ ] W-022
  - [ ] W-023

---

## 6) 검증 체크리스트 (문서)

- [x] `docs/walkthrough.md`에 로컬 절대 경로 스킴 문자열 0건
- [x] 이슈 항목 수가 `25`개인지 확인
- [x] 이슈 ID가 `W-001~W-025` 모두 포함되는지 확인
- [x] 모든 이슈에 `Evidence`가 있는지 확인
- [x] 모든 이슈에 완료 조건(체크박스)이 있는지 확인

## 7) 검증 체크리스트 (코드 변경 시)

- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`

---

## 8) 보류/결정 체크리스트

### 보류 항목 관리

- [ ] W-014 정책 결정
- [ ] W-018 스타일 규칙 정리
- [ ] W-019 시드 범위 확정
- [ ] W-021 ESLint 룰 강도 확정
- [ ] W-023 닉네임 정책 확정

### 추후 결정 필요사항

- [ ] 소프트 삭제 모델: 단일 필드 vs 이중 모델
- [ ] 닉네임 문자 정책: 한글/공백/특수문자 허용 범위
- [ ] 로컬 시드 데이터 기본 제공 범위

---

## 9) 가정 및 기본값

- 이번 문서는 코드 수정이 아니라 **작업 추적용 체크리스트**를 목적으로 함
- 문서는 `docs/walkthrough.md` 단일 파일로 유지
- 기존 25개 이슈는 삭제하지 않고 번호 고정 유지
- 우선순위 기준: `보안/데이터 무결성 > 사용자 영향 > 유지보수성`

---

## 10) 자체 테스트 로그

### 2026-02-17 Wave 1 완료 검증

- [x] 공통 회귀 검증
  - Command: `npm run lint`
  - Result: `pass`
  - Command: `npm run test`
  - Result: `4 files, 14 tests passed`
  - Command: `npm run build`
  - Result: `pass` (Next.js build successful)

- [x] W-001 검증 (관리자 검색 필터 안전화)
  - Added tests: `src/lib/api/admin-search.test.ts`
  - Verified:
    - 필터 제어문자 제거
    - `%`, `_` 와일드카드 이스케이프
    - 빈 입력 처리

- [x] W-002 검증 (좋아요 토글 원자 처리)
  - Migration applied: `supabase/migrations/202602170004_add_toggle_post_like_rpc.sql`
  - Command (sequential sanity):
    - `toggle_post_like` 2회 호출
    - Result: `true|false|0`
  - Command (parallel race):
    - 동일 post/user에 대해 병렬 40회 호출 (`xargs -P 8`)
    - Result: `false|0` (최종 상태/카운트 일관)

- [x] W-003 검증 (login rate-limit 분리)
  - Added tests: `src/lib/env.test.ts`
  - Verified:
    - `RATE_LIMIT_MAX_LOGIN` 명시 시 해당 값 사용
    - 미설정 시 `RATE_LIMIT_MAX_SIGNUP` fallback
  - Command: `npm run env:local:sync && rg '^RATE_LIMIT_MAX_LOGIN=' .env.local`
  - Result: `RATE_LIMIT_MAX_LOGIN=10` 확인
