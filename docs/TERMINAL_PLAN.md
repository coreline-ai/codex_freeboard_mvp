# 터미널 메뉴 Codex 전용 웹 터미널 설계 (App Server 기반)

## 요약
왼쪽 메뉴 `터미널` 선택 시 기존 placeholder를 제거하고, Codex App과 유사한 실시간 에이전트 UI를 웹에 제공한다.  
구현은 FastAPI 내부에 `Codex App Server` 게이트웨이를 추가하고, 프론트는 WebSocket 스트림 기반으로 채팅/명령출력/승인/디프를 렌더링한다.

선택 확정값:
- 연동 엔진: `Codex App Server`
- 런타임 위치: `API 서버 동일 호스트`
- 승인 정책: `위험 작업만 승인` (`untrusted`)
- 세션 저장: `메모리 + 로컬 NDJSON 로그`
- 동시 세션: `사용자당 1세션`
- 인증: `서버 ENV 키 방식`

## 목표와 성공 기준
1. `터미널` 메뉴 진입 시 Codex 전용 UI가 표시된다.
2. 프롬프트 입력 후 응답이 스트리밍으로 출력된다.
3. 명령/파일 변경 승인 요청이 웹 UI에서 처리된다.
4. `turn/diff/updated`와 `item/fileChange/outputDelta`가 파일 변경 패널에 반영된다.
5. 브라우저 새로고침 후 동일 사용자 세션에 재연결된다.
6. Codex 미설치/인증 미설정 시 사용자 친화적 오류 패널을 제공한다.

## 범위
포함:
- `view-terminal`을 Codex 전용 화면으로 대체
- FastAPI 라우터 + 세션 매니저 + app-server subprocess 브리지
- WS 이벤트 스트리밍
- 승인/중단/세션복구
- 테스트(백엔드 계약/WS/프론트 오프라인 렌더)

미포함:
- 멀티유저 인증 시스템 전면 도입
- DB 스키마 영속 저장
- 원격 워커 분산 실행

## 공개 인터페이스 변경 (API/타입)
### 신규 REST API
1. `POST /api/codex/session/start`
- Request:
```json
{
  "model": "o3",
  "cwd": "/Users/.../super_personal_desktop",
  "approval_policy": "untrusted",
  "sandbox": "workspace-write",
  "base_instructions": "..."
}
```
- Response:
```json
{
  "session_id": "codex-sess-...",
  "thread_id": "thread-...",
  "status": "ready",
  "model": "o3",
  "approval_policy": "untrusted",
  "sandbox": "workspace-write"
}
```

2. `GET /api/codex/session/current`
- Response:
```json
{
  "session_id": "...",
  "thread_id": "...",
  "status": "idle|running|awaiting_approval|error",
  "pending_approvals": 0,
  "events": []
}
```

3. `POST /api/codex/turn/start`
- Request:
```json
{
  "input_text": "요청 내용",
  "approval_policy": "untrusted",
  "sandbox": "workspace-write"
}
```
- Response:
```json
{
  "turn_id": "turn-...",
  "status": "started"
}
```

4. `POST /api/codex/turn/interrupt`
- Request:
```json
{
  "turn_id": "turn-..."
}
```
- Response:
```json
{
  "status": "interrupt_requested"
}
```

5. `POST /api/codex/approval/respond`
- Request:
```json
{
  "request_id": "jsonrpc-id",
  "kind": "command|file_change",
  "decision": "accept|decline|cancel|acceptForSession"
}
```
- Response:
```json
{
  "status": "submitted"
}
```

### 신규 WebSocket
1. `WS /api/codex/ws?session_id=...`
- 서버→클라이언트 envelope:
```json
{
  "seq": 101,
  "ts": "2026-02-17T14:00:00Z",
  "kind": "notification|approval_request|error|state",
  "method": "item/agentMessage/delta",
  "params": {}
}
```
- 클라이언트→서버는 사용하지 않음(명령성 액션은 REST로 통일).

### 사용자 식별 규칙
1. 프론트 `localStorage.codexClientId` 생성/보관.
2. 모든 codex API 요청에 `x-codex-client-id` 헤더 포함.
3. 백엔드는 `x-codex-client-id` 기준 `1 active session/user` 강제.

## 구현 설계
## 백엔드
1. 새 파일 `app/services/codex_app_server.py`
- `CodexSessionManager`
- `CodexSession`
- `CodexAppServerProcess`
- 책임:
  - subprocess spawn: `codex app-server`
  - JSON-RPC 요청/응답 매핑
  - stdout 라인 파싱 및 이벤트 브로드캐스트
  - pending approval request 관리
  - 세션 상태머신 관리
  - idle timeout cleanup

2. 새 파일 `app/routers/codex_terminal.py`
- 위 신규 REST/WS 엔드포인트 구현
- `api_error()` 규약 준수 (`VALIDATION_ERROR`, `NOT_FOUND`, `HTTP_ERROR` + `CODEX_UNAVAILABLE`, `CODEX_AUTH_MISSING` 추가)

3. `app/main.py`
- `codex_terminal` 라우터 등록
- 앱 종료 시 세션 매니저 `shutdown()` 호출하여 자식 프로세스 정리

4. JSON-RPC 프로토콜 고정
- 초기화:
  - `initialize`
  - `thread/start` (approvalPolicy/sandbox/cwd/model 적용)
- 턴:
  - `turn/start`
  - `turn/interrupt`
- 승인 요청 처리:
  - `item/commandExecution/requestApproval`
  - `item/fileChange/requestApproval`
  - 동일 `id`로 JSON-RPC response 반환 (`{ "decision": ... }`)

5. 기본 정책값
- `approvalPolicy="untrusted"`
- `sandbox="workspace-write"`
- `cwd=repo root`
- `model="o3"` (환경변수 오버라이드 가능)

6. 환경변수
- `APP_CODEX_TERMINAL_ENABLED=true`
- `APP_CODEX_MODEL=o3`
- `APP_CODEX_APPROVAL_POLICY=untrusted`
- `APP_CODEX_SANDBOX=workspace-write`
- `APP_CODEX_WORKDIR` (optional)
- `APP_CODEX_SESSION_IDLE_TIMEOUT_SEC=1800`
- `APP_CODEX_EVENT_LOG_DIR=${APP_DATA_DIR}/codex_sessions`
- 필수: `OPENAI_API_KEY`

7. 로깅/복구
- 이벤트를 NDJSON append 저장
- 세션별 최근 N개(예: 500개) ring buffer 유지
- `session/current`에서 snapshot+최근 이벤트 반환

## 프론트엔드
1. `web/index.html`
- `#view-terminal` placeholder 제거
- Codex 터미널 레이아웃 삽입:
  - 헤더(모델/상태/새 세션/중단)
  - 메인 스트림(assistant/user/event timeline)
  - 우측 패널(명령출력, 파일변경, 승인요청)
  - 입력 composer

2. `web/app.js`
- 상태 추가:
  - `state.codex = { clientId, sessionId, threadId, ws, status, activeTurnId, pendingApprovals, events }`
- 함수 추가:
  - `initCodexTerminal()`
  - `ensureCodexSession()`
  - `connectCodexWs()`
  - `startCodexTurn()`
  - `interruptCodexTurn()`
  - `submitCodexApproval()`
  - `renderCodexTerminal()`, `renderCodexEvent()`
- 메뉴 전환 훅:
  - `switchMenu("terminal")` 진입 시 세션 보장 + WS 연결
- 오류 UX:
  - codex 미설치/키누락 시 가이드 카드 표시
- 승인 UX:
  - approval 카드별 `승인/거절/취소/세션승인` 버튼

3. `web/styles.css`
- `.codex-terminal-*` 컴포넌트 스타일
- 기존 테마 변수 재사용
- 모바일 대응(단일 컬럼 스택)

## 상태머신
1. `starting` → `ready`
2. `ready` + turn start → `running`
3. `running` + approval request → `awaiting_approval`
4. approval submit 후 `running`
5. `turn/completed` → `idle`
6. 예외 발생 → `error`
7. idle timeout 또는 수동 종료 → `closed`

## 엣지케이스/실패 모드
1. `codex` 바이너리 없음: `CODEX_UNAVAILABLE` 반환 + 설치 가이드.
2. `OPENAI_API_KEY` 없음: `CODEX_AUTH_MISSING` 반환 + 환경변수 안내.
3. WS 끊김: 지수 백오프 재연결(최대 5회), 실패 시 수동 재연결 버튼 노출.
4. 중복 turn 요청: 현재 turn 완료 전 409 처리.
5. 승인 요청 stale id: 404 처리.
6. app-server 비정상 종료: 세션 상태 `error` + 재시작 버튼 제공.

## 테스트 계획
## 백엔드 테스트
1. `tests/test_codex_terminal_api.py`
- 세션 시작 성공/실패(미설치, 인증누락)
- turn 시작/중단
- approval submit
- 단일 사용자 1세션 강제

2. `tests/test_codex_terminal_ws.py`
- WS 연결 시 이벤트 수신
- approval_request 이벤트 전달
- turn 완료 이벤트 후 상태 전이 검증

3. 목킹 전략
- 실제 `codex app-server` 대신 fake transport 사용
- JSON-RPC 샘플은 `codex app-server generate-json-schema` 기반 method name 고정

## 프론트 테스트
1. `tests/test_frontend_offline_e2e.py` 확장
- `터미널` 메뉴 진입 시 Codex UI 렌더 확인
- API 오류 카드 렌더 확인
2. `tests/test_frontend_e2e.py` 확장
- mock codex gateway 응답으로 turn 스트림/approval UI 동작 검증

## 운영/배포
1. 1차 릴리스: 기능 활성 기본값 `true`, 오류 시 graceful fallback UI.
2. 모니터링:
- request 로그: `/api/codex/*` latency/status
- 세션 상태/turn 실패율
- approval 대기 시간
3. 장애 대응:
- 세션 강제종료 endpoint(내부용) 추가 가능
- 로그 파일 기반 재현 가능

## 구현 순서
1. 백엔드 서비스/라우터 골격 + JSON-RPC 브리지
2. REST/WS 계약 테스트 작성
3. 프론트 `view-terminal` UI + 상태관리
4. 승인/디프/출력 패널 완성
5. E2E 시나리오 추가
6. 문서(README/DEPLOYMENT/API_CHANGELOG) 업데이트

## 명시적 가정 및 기본값
1. 현재 앱은 인증이 없으므로 `x-codex-client-id`를 사용자 식별자로 사용한다.
2. `CLI 챗봇` 메뉴는 유지하고, `터미널` 메뉴만 Codex 전용 UI로 교체한다.
3. DB 마이그레이션은 수행하지 않는다.
4. App Server 프로토콜은 v2(`thread/start`, `turn/start`)를 기준으로 구현한다.
5. 승인 정책은 기본 `untrusted`, 샌드박스는 `workspace-write`로 시작한다.

## 참고 소스
1. Codex App Server 공식 문서: https://developers.openai.com/codex/app-server
2. Codex Non-interactive 공식 문서: https://developers.openai.com/codex/noninteractive
3. Codex Quickstart: https://developers.openai.com/codex/quickstart
