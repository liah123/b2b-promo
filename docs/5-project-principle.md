# 프로젝트 구조 설계 원칙 — Stamp Up

버전: v1.1 (작성일: 2026-08-13, v1.0→v1.1: docs 정합성 검토 — 근거 문서 버전 갱신, 6장 pages에 스탬프 홈 화면 추가, 7장 마이그레이션 파일 순서를 FK 의존성에 맞게 재정렬)
근거 문서: `docs/1-domain-definition.md` (v1.5), `docs/2-usecase.md`, `docs/3-PRD.md` (v1.4), `docs/4-user-scenari.md` (v1.1)

> 전제: 1인 개발·3일 완성 목표의 교육용 바이브코딩 MVP. 모든 원칙은 "이 정도 구조로 왜 충분한가"를 함께 명시하며, 문서 어디에도 없는 확장 포인트(DI 컨테이너, 이벤트버스, 마이크로서비스 분리 등)는 도입하지 않는다.

---

## 1. 모든 스택에 공통인 최상위 원칙

| 원칙 | 내용 | 왜 이 정도로 충분한가 |
|---|---|---|
| YAGNI | 지금 화면/API에 필요 없는 기능·옵션·설정은 만들지 않는다 | 3일 일정에 "나중에 쓸지도 모르는" 코드를 짤 시간이 없다 |
| 단일 책임 | 함수/모듈 하나는 한 가지 일만 한다 (예: 미션 완료 처리와 스탬프 지급은 별도 함수, 하나의 트랜잭션에서 호출) | 책임이 섞이면 1인 개발자도 디버깅 시 헤맨다 |
| 명시적 > 암묵적 | 매직 넘버·암묵적 상태 대신 명시적 enum/상수 사용 (예: `status: 'JOINED' \| 'COMPLETED'`) | 문서(도메인 정의서)의 상태값을 코드에 그대로 반영하면 문서-코드 괴리가 없다 |
| 조기 최적화 금지 | 캐시 레이어, 인덱스 튜닝, 쿼리 최적화는 실측 문제가 생긴 뒤에 한다 | PRD 4장: PostgreSQL 기본 인덱스·커넥션 풀 수준이면 충분하다고 이미 합의됨 |
| 표준 우선 | 커스텀 라이브러리보다 Node/브라우저 표준 API, 이미 선택된 스택(Express, pg, TanStack Query)의 기본 기능을 우선 사용 | 새 의존성 추가는 3일 일정에서 학습 비용 자체가 리스크 |
| 문서가 곧 스펙 | 엔티티명·필드명·상태값은 도메인 정의서 3장을 그대로 코드에 옮긴다 (임의 재해석 금지) | 1인 개발이라도 문서와 코드가 어긋나면 되돌아볼 기준이 사라진다 |
| 되돌릴 수 있게 작다 | 커밋/변경 단위는 화면 또는 API 엔드포인트 1개 수준으로 작게 | 3일 안에 문제가 생기면 큰 커밋을 되돌릴 여유가 없다 |
| 완료 조건 판정은 단순하게 | 복잡한 외부 연동 없이 "테스트용 완료 처리/관리자 확인" 그대로 구현 | 도메인 정의서 7장에서 이미 단순화가 허용된 가정임 |

---

## 2. 의존성/레이어 원칙

PRD 5.2의 레이어 구조를 그대로 따른다 — **3-레이어(routes → controllers/services → db) 이상 금지**.

```
routes        요청 파싱, 인증/권한 미들웨어 연결, controller 호출만 담당 (로직 없음)
controllers   요청→서비스 호출→응답 변환만 담당 (비즈니스 로직 없음)
services      도메인 로직 (참여/완료/스탬프 지급/교환) + pg 트랜잭션(BEGIN/COMMIT)
db (pg Pool)  쿼리 실행
```

- 의존 방향은 항상 위 → 아래 단방향. `db`가 `services`를 참조하는 등 역방향 의존 금지.
- **레포지토리 패턴/도메인 계층 프레임워크/DI 컨테이너 도입 금지** — PRD 5.2에 명시된 대로 3-레이어로 충분.
- 트랜잭션이 필요한 곳(미션 완료 처리, 리워드 교환)은 서비스 함수 안에서 `BEGIN ~ COMMIT/ROLLBACK`으로 직접 감싼다. 별도 트랜잭션 매니저/유닛오브워크 클래스 불필요.
- 프론트도 동일한 방향성: `pages`(화면) → `hooks(TanStack Query)`(서버 상태) → `api client`(fetch 래퍼) → Express API. Zustand는 서버 상태가 아닌 "로그인 사용자 정보 + access token"만 담당(TanStack Query와 책임 분리).
- 공용 로직(예: 재료별 보유 스탬프 계산, 날짜 기준 미션 상태 계산)은 각 레이어 내부에 유틸 함수로 두되, 새로운 "도메인 레이어"를 별도로 만들지 않는다 — services 폴더 안의 순수 함수로 충분.

---

## 3. 코드/네이밍 원칙

| 대상 | 컨벤션 | 예시 |
|---|---|---|
| DB 테이블/컬럼 | snake_case, 테이블명 복수형 | `mission_participations`, `ingredient_type`, `stamp_count` |
| JS/TS 변수·함수·객체 필드 | camelCase | `ingredientType`, `stampCount`, `joinedAt` |
| DB ↔ JS 매핑 | 쿼리 결과를 서비스 경계에서 camelCase로 변환(단순 매핑 함수 1개, ORM 도입 안 함) | `mission_id → missionId` |
| 상태값(enum) | DB는 대문자 문자열(CHECK 제약), JS는 동일 문자열 리터럴 유니온 타입 | `'PENDING' \| 'ACTIVE' \| 'ENDED'`, `'JOINED' \| 'COMPLETED'`, `'EARN' \| 'USE'`, `'ACTIVE' \| 'INACTIVE'` |
| 엔티티명 → 파일/모듈명 | 도메인 정의서 엔티티명 그대로 파스칼/카멜 변환 | `Mission` → `mission.service.js`, `mission.controller.js`, `mission.routes.js` |
| ID 컬럼 | `{엔티티}Id` / `{entity}_id` | `missionId`/`mission_id`, `userId`/`user_id` |
| 라우트 경로 | PRD 5.2와 동일하게 복수형 리소스명 | `/missions`, `/participations`, `/stamps`, `/rewards`, `/redemptions`, `/users/me` |
| Boolean | `is`/`has` 접두사 (신규 도입 시) | `isActive` 대신 도메인 정의서엔 status enum을 쓰므로 상태값 우선, 별도 boolean 남발 금지 |

- 도메인 정의서에 없는 필드명을 임의로 만들지 않는다 (예: `recipe`를 `ingredients`로 바꾸지 않음).
- 약어·축약 금지, 문서 용어 그대로: `ingredientType`(재료 종류), `stampCount`(지급 개수), `recipe`(레시피), `completionCondition`(완료 조건).

---

## 4. 테스트/품질 원칙

1인·3일 규모에 맞춰 **전수 커버리지 강요 금지**. 아래 핵심 비즈니스 로직에만 최소 단위/통합 테스트를 작성한다.

| 대상 로직 | 테스트 종류 | 검증 내용 |
|---|---|---|
| 중복 참여 방지 | 통합(서비스+DB) | 동일 (mission, user) 재참여 시도 시 유니크 제약/서비스 레벨에서 거부 |
| 중복 스탬프 지급 방지 | 통합 | 이미 COMPLETED인 참여 건에 완료 처리 재요청 시 StampTransaction 추가 생성 안 됨 |
| 리워드 교환 조건 충족 판정 | 단위 | 레시피 재료 중 하나라도 부족하면 교환 거부, 모두 충족 시에만 통과 |
| 리워드 교환 시 차감 트랜잭션 | 통합 | 교환 성공 시 레시피 재료 수만큼 StampTransaction(USE)이 생성되고 RewardRedemption 1건 기록 |
| 재료별 스탬프 잔액 계산 | 단위 | Σ(EARN) − Σ(USE)가 ingredientType별로 올바르게 집계되는지 |

- 그 외(회원가입 검증, CRUD 단순 조회 등)는 수동 QA(3일차 E2E 점검)로 대체하고 자동화 테스트를 강제하지 않는다.
- 테스트 프레임워크는 신규 도입 최소화: 백엔드는 Node 기본 `node:test` + `assert`로 충분(별도 러너 도입은 선택, 강제하지 않음).
- 프론트는 핵심 화면 단위 테스트를 강제하지 않고, 3일차 수동 E2E로 대체한다.
- 린트/포맷은 기존 프로젝트 설정(ESLint/Prettier 등 이미 있다면 그대로) 수준이면 충분, 신규 정적분석 도구 도입 금지.

---

## 5. 설정/보안/운영 원칙

- **인증**: JWT access token(짧은 만료) + refresh token(긴 만료) 조합. Access token은 응답 바디로 전달해 프론트 메모리(Zustand)에 보관, refresh token은 httpOnly 쿠키 + `refresh_tokens` 테이블(rotation 없이 단순 폐기만 지원)로 관리.
- **비밀번호**: 해싱 후 저장(bcrypt 등 표준 라이브러리), 평문 저장/로깅 금지.
- **환경변수(.env)**: DB 접속정보, JWT 시크릿, 토큰 만료시간은 `.env`로 분리하고 `.gitignore`에 포함(레포 상태에 이미 Node .gitignore 추가됨). `.env.example`로 필요한 키 목록만 공유.
- **ADMIN 계정**: 회원가입 화면 없이 DB seed 스크립트로 1회 생성 (도메인 정의서 7장 규칙 그대로).
- **권한 분리**: `authGuard`(JWT 검증) + `roleGuard`(ADMIN 체크) 미들웨어 2개로 충분 — 별도 정책 엔진/RBAC 프레임워크 도입 금지.
- **동시성**: `mission_participations(mission_id, user_id)` 유니크 제약 + 완료 처리/교환 처리의 단일 DB 트랜잭션으로 중복 참여·중복 지급·중복 교환 방지. 큐/락 매니저 등 별도 인프라 불필요(PRD 7장 리스크 대응과 동일).
- **로깅/모니터링**: 콘솔 로그 + Express 에러 핸들러 수준으로 충분. 별도 로그 수집기·모니터링 스택(ELK, Prometheus 등) 도입 금지 — 3일 MVP 범위 밖.
- **배포**: 3일차에 데모 가능한 수준(로컬 또는 단일 서버 실행)이면 충분, CI/CD 파이프라인 구축은 선택 사항으로 강제하지 않는다.

---

## 6. 프론트엔드 디렉토리 구조

React 19 + Zustand + TanStack Query, PRD 5.2 pages 목록과 1:1 대응.

```
frontend/
├─ src/
│  ├─ pages/
│  │  ├─ auth/
│  │  │  ├─ LoginPage.tsx
│  │  │  └─ SignupPage.tsx
│  │  ├─ home/
│  │  │  └─ StampHomePage.tsx  # 로그인 직후 첫 화면(PRD 3.2 "스탬프 홈")
│  │  ├─ missions/
│  │  │  ├─ MissionListPage.tsx
│  │  │  ├─ MissionDetailPage.tsx
│  │  │  └─ MyMissionsPage.tsx
│  │  ├─ stamps/
│  │  │  └─ StampsPage.tsx
│  │  ├─ rewards/
│  │  │  ├─ RewardListPage.tsx
│  │  │  └─ MyRedemptionsPage.tsx
│  │  ├─ mypage/
│  │  │  └─ MyPage.tsx
│  │  └─ admin/
│  │     ├─ MissionManagePage.tsx
│  │     └─ RewardManagePage.tsx
│  ├─ components/          # 여러 페이지에서 재사용하는 순수 UI 컴포넌트만
│  ├─ hooks/                # TanStack Query 훅 (엔티티별)
│  │  ├─ useAuth.ts
│  │  ├─ useMissions.ts
│  │  ├─ useParticipations.ts
│  │  ├─ useStamps.ts
│  │  └─ useRewards.ts
│  ├─ api/                  # fetch 래퍼 (엔드포인트별 함수), access token 401 → refresh 재시도
│  │  ├─ client.ts           # 공통 fetch 인스턴스 + refresh 인터셉트
│  │  ├─ authApi.ts
│  │  ├─ missionApi.ts
│  │  ├─ stampApi.ts
│  │  └─ rewardApi.ts
│  ├─ store/
│  │  └─ authStore.ts        # Zustand: 로그인 사용자 정보, access token(메모리)
│  ├─ routes/
│  │  └─ router.tsx           # 라우트 정의 + 인증가드(로그인 필요)/역할가드(ADMIN)
│  ├─ types/
│  │  └─ domain.ts            # User/Mission/MissionParticipation/StampTransaction/Reward/RewardRedemption 타입
│  ├─ App.tsx
│  └─ main.tsx
├─ index.html
└─ package.json
```

- `components/`는 버튼/카드/모달 등 순수 UI에 한정, 페이지 전용 마크업은 각 `pages/*.tsx`에 그대로 둔다 (컴포넌트 조기 추출 금지).
- 상태 관리 계층 분리: 서버 데이터는 전부 TanStack Query, 클라이언트 전역 상태(로그인 사용자, 토큰)만 Zustand. Redux/Context 조합 등 추가 상태 라이브러리 도입 금지.

---

## 7. 백엔드 디렉토리 구조

Node.js + Express + pg, PRD 5.2 routes/DB 테이블과 1:1 대응.

```
backend/
├─ src/
│  ├─ routes/
│  │  ├─ auth.routes.js          # /auth (login/refresh/logout)
│  │  ├─ mission.routes.js       # /missions
│  │  ├─ participation.routes.js # /participations
│  │  ├─ stamp.routes.js         # /stamps
│  │  ├─ reward.routes.js        # /rewards
│  │  ├─ redemption.routes.js    # /redemptions
│  │  ├─ user.routes.js          # /users (me)
│  │  └─ index.js                 # 라우트 취합
│  ├─ controllers/
│  │  ├─ auth.controller.js
│  │  ├─ mission.controller.js
│  │  ├─ participation.controller.js
│  │  ├─ stamp.controller.js
│  │  ├─ reward.controller.js
│  │  ├─ redemption.controller.js
│  │  └─ user.controller.js
│  ├─ services/
│  │  ├─ auth.service.js          # 토큰 발급/재발급/폐기, 비밀번호 해싱/검증
│  │  ├─ mission.service.js       # 미션 CRUD, 상태 자동 계산
│  │  ├─ participation.service.js # 참여, 완료 처리(트랜잭션: 상태변경+스탬프지급)
│  │  ├─ stamp.service.js         # 재료별 잔액/이력 조회
│  │  ├─ reward.service.js        # 리워드 CRUD, 상태 관리
│  │  ├─ redemption.service.js    # 교환 조건 판정 + 교환 트랜잭션(차감+기록)
│  │  └─ user.service.js          # 내 정보 조회/수정, 비밀번호 변경
│  ├─ middleware/
│  │  ├─ authGuard.js             # access token 검증
│  │  ├─ roleGuard.js             # ADMIN 체크
│  │  └─ errorHandler.js
│  ├─ db/
│  │  ├─ pool.js                  # pg Pool 인스턴스
│  │  └─ migrations/
│  │     ├─ 001_users.sql
│  │     ├─ 002_missions.sql
│  │     ├─ 003_mission_participations.sql
│  │     ├─ 004_rewards.sql
│  │     ├─ 005_reward_redemptions.sql
│  │     ├─ 006_stamp_transactions.sql   # FK로 reward_redemptions 참조하므로 그 뒤에 실행
│  │     └─ 007_refresh_tokens.sql
│  ├─ seed/
│  │  └─ admin.seed.js            # ADMIN 계정 DB seed
│  ├─ app.js                       # Express 앱 설정(미들웨어, 라우트 연결)
│  └─ server.js                    # 서버 기동 진입점
├─ .env.example
└─ package.json
```

- DB 테이블(`users, missions, mission_participations, stamp_transactions, rewards, reward_redemptions, refresh_tokens`)과 `services/`, `db/migrations/` 파일이 1:1로 대응해 어느 파일에 어떤 로직이 있는지 즉시 찾을 수 있게 한다.
- 트랜잭션이 필요한 서비스(`participation.service.js`의 완료 처리, `redemption.service.js`의 교환)는 각 함수 내부에서 `pool.connect()` → `BEGIN` → 쿼리 → `COMMIT/ROLLBACK` → `release()`로 직접 처리, 별도 트랜잭션 헬퍼 계층 없이 함수 하나로 완결한다.
