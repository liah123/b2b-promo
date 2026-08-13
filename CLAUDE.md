# b2b-promo 프로젝트의 최상위 지침

## 반드시 준수할 최우선 지침

- 모든 대화는 한국어로 할 것
- 오버엔지니어링 금지

## 개발할 떄 다음 사항을 준수할 것

- 안드레 카파시의 CLAUDE.md
- https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/refs/heads/main/CLAUDE.md

## 참조 문서 (docs/)

작업 전 관련 문서를 먼저 확인할 것. 번호 순서대로 상위 문서가 하위 문서의 근거가 된다.

| 문서 | 내용 |
|---|---|
| `docs/1-domain-definition.md` | 도메인 정의서 — 핵심 액터/엔티티/유스케이스/비즈니스 규칙/MVP 범위 |
| `docs/2-usecase.md` | 유스케이스 다이어그램 (Mermaid) |
| `docs/3-PRD.md` | 제품 요구사항 정의서 — 범위, 기능/비기능 요구사항, 기술스택, 일정 |
| `docs/4-user-scenari.md` | 사용자 시나리오 (정상/예외 케이스) |
| `docs/5-project-principle.md` | 프로젝트 구조 설계 원칙 — 레이어/네이밍/테스트/보안, 프론트·백엔드 디렉토리 구조 |
| `docs/6-arch-diagram.md` | 기술 아키텍처 다이어그램 (Mermaid) |
| `docs/7-wireframe.md` | 화면 와이어프레임 (0장 용어 매핑표 포함) |
| `docs/8-erd.md` | ERD (Mermaid) |
| `docs/8-schema.sql` | PostgreSQL DDL |
| `docs/9-plan.md` | 개발 실행계획 — DB/BE/FE Task 분해, 의존관계, 완료조건 체크박스 |
| `docs/swagger.json` | OpenAPI 3.0 API 스펙 |

문서 간 불일치를 발견하면 임의로 판단하지 말고 정합성 검토 후 수정할 것.
