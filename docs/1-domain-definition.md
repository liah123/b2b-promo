# 도메인 정의서 — Stamp Up (식자재 유통 B2B 미션형 프로모션·스탬프 리워드)

버전: v1.1 (최종 수정일: 2026-08-13, 변경 이력은 11장 참고)

## 1. 개요
Stamp Up은 식자재를 구매하는 외식업체·급식업체 등 B2B 거래처 담당자를 대상으로, 관리자가 등록한 미션형 프로모션에 참여하고 완료 시 스탬프를 획득하여 리워드로 교환하는 웹 애플리케이션이다. 관리자는 미션과 리워드를 등록·관리하고, 거래처 담당자는 로그인 후 미션에 참여·완료하여 스탬프를 쌓고 이를 리워드로 교환한다. 교육용 바이브코딩 실습 MVP로, 핵심 흐름(미션 참여 → 미션 완료 → 스탬프 획득 → 리워드 교환)에 집중한다.

## 2. 핵심 액터
| 액터 | 설명 |
|---|---|
| 거래처 담당자 (User, role=CUSTOMER) | 식자재를 구매하는 외식업체/급식업체 등의 담당자. 미션 조회·참여·완료, 스탬프 확인, 리워드 교환을 수행 |
| 관리자 (User, role=ADMIN) | 미션과 리워드를 등록·관리하고, 필요 시 미션 완료를 확인·처리 |

## 3. 핵심 도메인 엔티티
| 엔티티 | 설명 | 주요 속성 |
|---|---|---|
| User | 거래처 담당자 또는 관리자 계정 | userId, email, password, name, role(CUSTOMER/ADMIN), createdAt |
| Mission | 관리자가 등록하는 미션형 프로모션 | missionId, title, description, startAt, endAt, completionCondition, stampReward(지급 스탬프 개수), status(예정(PENDING)/진행중(ACTIVE)/종료(ENDED)), createdBy |
| MissionParticipation | 사용자의 미션 참여 기록 (사용자-미션 조합당 1건) | participationId, userId, missionId, status(참여중(JOINED)/완료(COMPLETED)), joinedAt, completedAt |
| StampTransaction | 스탬프 증감 이력 | transactionId, userId, type(적립(EARN)/차감(USE)), amount(항상 양수), reason(미션완료/리워드교환), relatedMissionId, relatedRedemptionId, createdAt |
| Reward | 스탬프로 교환 가능한 리워드 | rewardId, name, description, requiredStamps, status(활성(ACTIVE)/비활성(INACTIVE)) |
| RewardRedemption | 사용자의 리워드 교환 내역 | redemptionId, userId, rewardId, usedStamps, redeemedAt |

## 4. 엔티티 관계
- User(거래처 담당자)는 여러 MissionParticipation을 가진다 (1:N)
- Mission은 여러 MissionParticipation을 가진다 (1:N) — 단, 동일 (Mission, User) 조합은 하나의 MissionParticipation만 존재
- MissionParticipation이 완료 상태가 되면 해당 User에게 StampTransaction(적립)이 1건 생성된다 (1:1)
- User는 여러 StampTransaction을 가진다 (1:N) — 보유 스탬프 잔액 = Σ(적립 amount) − Σ(차감 amount)
- User는 여러 RewardRedemption을 가진다 (1:N)
- Reward는 여러 RewardRedemption에 참조된다 (1:N)
- RewardRedemption이 발생하면 해당 User에게 StampTransaction(차감)이 1건 생성된다 (1:1)

## 5. 유스케이스 (액터별)

### 공통
- 회원가입 / 로그인
- 로그인 후에만 미션, 스탬프, 리워드 등 기능 이용 가능 (인증 필수)
- 마이페이지에서 내 정보 조회/수정, 비밀번호 변경

### 거래처 담당자
- 진행 중/예정 미션 목록 및 상세 조회
- 진행 중인 미션에 참여
- 참여 중인 미션과 완료한 미션 구분 조회
- (테스트용 완료 처리 또는 관리자 확인을 통해) 미션 완료 조건 충족 시 스탬프 획득
- 보유 스탬프 개수 및 스탬프 획득·사용 이력 조회
- 교환 가능한 리워드 목록 및 필요 스탬프 개수 조회
- 보유 스탬프가 충분한 리워드를 교환
- 자신이 교환한 리워드 내역 조회

### 관리자
- 미션 등록/수정 (미션명, 설명, 참여 기간, 완료 조건, 지급 스탬프 개수)
- 미션 상태 관리 (예정/진행중/종료)
- 미션 완료 확인 처리 (테스트용 완료 처리 방식 포함)
- 리워드 등록/수정 및 활성/비활성 상태 관리

## 6. 상태(Status) 정의
| 엔티티 | 상태값 | 의미 | 전이 조건 |
|---|---|---|---|
| Mission | 예정 → 진행중 → 종료 | 예정: 참여 기간 이전 / 진행중: 참여 기간 내 / 종료: 참여 기간 이후 또는 관리자 종료 처리 | 참여 기간(startAt/endAt) 기준 자동 계산이 우선이며, 관리자의 수동 종료 처리는 기간 중이라도 강제로 종료 상태로 전이시키는 예외로만 적용된다 |
| MissionParticipation | 참여중 → 완료 | 참여중: 미션 참여만 한 상태 / 완료: 완료 조건 충족 및 스탬프 지급 완료 | 완료 조건 충족(테스트용 완료 처리 또는 관리자 확인) |
| Reward | 활성 ↔ 비활성 | 활성: 신규 교환 가능 / 비활성: 신규 교환 불가 | 관리자 수동 변경 |

## 7. 비즈니스 규칙 및 예외케이스
- 이메일은 유일해야 한다 — 동일 이메일로 중복 가입할 수 없다.
- 미션에는 반드시 참여 기간과 완료 조건이 존재하며, 참여 기간 내에만 신규 참여가 가능하다.
- "미션 참여"는 (미션, 사용자) 조합당 유일하다 — 동일 사용자가 동일 미션에 중복 참여할 수 없다.
- 미션 완료는 완료 조건을 충족한 경우에만 가능하다.
- @

## 8. 권한/역할
| 역할 | 할 수 있는 것 |
|---|---|
| 거래처 담당자 (CUSTOMER) | 미션 조회/참여, 미션 완료(테스트용 처리), 스탬프 조회, 리워드 조회/교환, 마이페이지 |
| 관리자 (ADMIN) | 미션 등록/수정/상태관리, 미션 완료 확인 처리, 리워드 등록/수정/상태관리, 마이페이지 |

## 9. MVP 범위

### 포함
- 회원가입/로그인
- 미션 등록·조회·참여·완료
- 스탬프 지급 및 이력 조회
- 리워드 등록·조회·교환
- 마이페이지 (내 정보 조회/수정, 비밀번호 변경)

### 제외
- 실제 주문/결제/정산
- 실제 주문 데이터와 미션 자동 연동
- ERP·상품·재고 시스템 연동
- 실제 쿠폰 발급 시스템 연동
- 거래처 등급별 차등 혜택
- 승인 워크플로우
- 포인트·캐시
- 검색 기능
- 알림톡·SMS·푸시
- 랭킹·배지·레벨 등 추가 게이미피케이션

## 10. 참고 자료
- 관련 기획 프롬프트: C:\_vide\b2b-promo\prompts (해당 디렉토리 내 프롬프트 파일 참고)

## 11. 변경 이력
| 버전 | 날짜/시간 | 변경 내용 |
|---|---|---|
| v1.0 | 2026-08-13 | 최초 작성 |
| v1.1 | 2026-08-13 | 5기준 평가 개선안 반영 — status enum 영문 병기, Mission 상태 전이 우선순위 명시, StampTransaction.amount 부호/잔액 산식 명시, 이메일 유일성 규칙 추가, 변경 이력 섹션 추가 |
