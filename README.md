# YumStamp

식자재 유통 B2B 거래처 담당자를 대상으로, 관리자가 등록한 미션형 프로모션에 참여해 스탬프를 모으고 리워드로 교환하는 웹 애플리케이션입니다.

## 📄 기획/설계 문서 (docs)

| 문서 | 내용 |
|---|---|
| [`docs/1-domain-definition.md`](docs/1-domain-definition.md) | 도메인 정의서 — 핵심 액터/엔티티/유스케이스/비즈니스 규칙/MVP 범위 |
| [`docs/2-usecase.md`](docs/2-usecase.md) | 유스케이스 다이어그램 (Mermaid) |
| [`docs/3-PRD.md`](docs/3-PRD.md) | 제품 요구사항 정의서 — 범위, 기능/비기능 요구사항, 기술스택, 일정 |
| [`docs/4-user-scenari.md`](docs/4-user-scenari.md) | 사용자 시나리오 (정상/예외 케이스) |
| [`docs/5-project-principle.md`](docs/5-project-principle.md) | 프로젝트 구조 설계 원칙 — 레이어/네이밍/테스트/보안, 프론트·백엔드 디렉토리 구조 |
| [`docs/6-arch-diagram.md`](docs/6-arch-diagram.md) | 기술 아키텍처 다이어그램 (Mermaid) |
| [`docs/7-wireframe.md`](docs/7-wireframe.md) | 화면 와이어프레임 (용어 매핑표 포함) |
| [`docs/8-erd.md`](docs/8-erd.md) | ERD (Mermaid) |
| [`docs/8-schema.sql`](docs/8-schema.sql) | PostgreSQL DDL |
| [`docs/9-plan.md`](docs/9-plan.md) | 개발 실행계획 — DB/BE/FE Task 분해, 의존관계, 완료조건 체크박스 |
| [`docs/10-style.md`](docs/10-style.md) | 스타일 가이드 — 디자인 컨셉·컬러·컴포넌트 톤앤매너 |
| [`docs/swagger.json`](docs/swagger.json) | OpenAPI 3.0 API 스펙 |

## 🔗 Demo Site

- Frontend: https://qwer-098-fe.vercel.app
- Backend: https://qwer-098-be.vercel.app

## 👤 테스트용 사용자 계정

| 구분 | 이메일 | 비밀번호 |
|---|---|---|
| 관리자 (ADMIN) | `admin@stampup.local` | `change-me-1234` |
| 거래처 담당자 (CUSTOMER) | `demo@yumstamp.local` | `demo1234` |

## ✅ 간략한 테스트 시나리오

1. **회원가입/로그인**: `/signup`에서 신규 계정 생성 후 로그인 (또는 위 데모 계정 사용)
2. **미션 참여 (거래처 담당자)**: 홈 또는 "적립 안내"에서 진행 중인 미션을 확인하고 상세 페이지에서 "적립 요청하기" 클릭
3. **적립 확인 처리 (관리자)**: 관리자 계정으로 로그인 → "적립 항목 관리" → 해당 미션의 "참여자 목록" → "적립 확인 처리" 클릭
4. **스탬프 확인**: 거래처 담당자 계정으로 "이용 내역"에서 스탬프 적립 내역 확인
5. **리워드 교환**: "쿠폰/혜택"에서 필요 스탬프를 충족한 리워드의 "쿠폰 받기" 클릭 → "쿠폰 사용 내역"에서 교환 이력 확인
6. **마이페이지**: 내 정보 수정, 비밀번호 변경
7. **관리자 기능**: "혜택 관리"에서 리워드 등록/수정 및 활성·비활성 상태 전환

예외 케이스(이메일 중복 가입, 잘못된 비밀번호 로그인, 미인증 상태에서 관리자 페이지 접근 등)는 [`docs/4-user-scenari.md`](docs/4-user-scenari.md)를 참고하세요.
