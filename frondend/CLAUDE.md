# b2b-promotion 프론트엔드앱 개발을 위한 지침

## 기술 스택

`docs/3-PRD.md` 5.1 기준. 아래 스택 외 임의로 라이브러리를 추가하지 않는다.

| 구분 | 기술 |
|---|---|
| 프레임워크 | React 19 |
| 전역 상태 관리 | Zustand |
| 서버 상태/통신 | TanStack Query |
| 통신 방식 | REST API(JSON), JWT Bearer access token / refresh token은 httpOnly 쿠키 |

- access token 만료(401) 시 TanStack Query에서 refresh 후 원요청 재시도.
- 로그인 사용자 정보·access token은 Zustand로 메모리 보관(별도 영속화 없음).

## 참조 문서

프론트엔드 작업 전 관련 문서를 먼저 확인할 것.

| 문서 이름 | 문서 | 내용 |
|---|---|---|
| 도메인 정의서 | [`../docs/1-domain-definition.md`](../docs/1-domain-definition.md) | 엔티티/비즈니스 규칙/MVP 범위 — 화면에 표시할 데이터와 상태값의 근거 |
| 유스케이스 다이어그램 | [`../docs/2-usecase.md`](../docs/2-usecase.md) | 액터별 화면 흐름 |
| PRD | [`../docs/3-PRD.md`](../docs/3-PRD.md) | 기능/비기능 요구사항, 프론트 기술스택(React19/Zustand/TanStack Query) |
| 사용자 시나리오 | [`../docs/4-user-scenari.md`](../docs/4-user-scenari.md) | 화면별 정상/예외 흐름 시나리오 |
| 프로젝트 구조 설계 원칙 | [`../docs/5-project-principle.md`](../docs/5-project-principle.md) | 프론트엔드 디렉토리 구조, 네이밍, 상태관리 원칙 |
| 기술 아키텍처 다이어그램 | [`../docs/6-arch-diagram.md`](../docs/6-arch-diagram.md) | 프론트-백엔드 통신 구조, 컴포넌트 구조 |
| 와이어프레임 | [`../docs/7-wireframe.md`](../docs/7-wireframe.md) | 화면별 레이아웃(데스크탑/모바일), 용어 매핑표 |
| 스타일 가이드 | [`../docs/10-style.md`](../docs/10-style.md) | 컬러/타이포/컴포넌트 등 비주얼 스타일 시스템 |
| 개발 실행계획 | [`../docs/9-plan.md`](../docs/9-plan.md) | FE Task 분해, 의존관계, 완료조건 체크박스 |
| API 스펙 | [`../docs/swagger.json`](../docs/swagger.json) | OpenAPI 3.0 API 스펙 — 실제 백엔드 구현 기준 |
