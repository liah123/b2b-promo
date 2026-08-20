# 유스케이스 다이어그램 — YumStamp

`1-domain-definition.md` 5장(유스케이스, v1.6)을 기반으로 작성. Mermaid는 UML 유스케이스 다이어그램 전용 문법이 없어 `flowchart`로 액터·시스템 경계·유스케이스를 표현한다. 로그인 인증 방식(access/refresh token)의 기술적 구현은 `3-PRD.md` 4·5장 참고.

> 표시 텍스트의 용어는 `7-wireframe.md` 0장 매핑 기준(내부 엔티티명·id는 변경 없음).

```mermaid
flowchart LR
    customer(["거래처 담당자<br/>(CUSTOMER)"])
    admin(["관리자<br/>(ADMIN)"])

    subgraph system["YumStamp"]
        direction TB

        subgraph common["공통"]
            UC01([회원가입])
            UC02([로그인])
            UC03([마이페이지 조회/수정])
            UC04([비밀번호 변경])
            UC05([로그아웃])
        end

        subgraph mission["미션·스탬프"]
            UC10([스탬프 적립 안내 조회])
            UC11([적립 요청/자세히 보기])
            UC12([적립 진행 현황 조회])
            UC13([적립 확인 처리])
            UC14([스탬프 적립])
            UC15([재료별 스탬프 보유량/이력 조회])
        end

        subgraph reward["쿠폰/혜택"]
            UC20([쿠폰/혜택 목록 조회])
            UC21([쿠폰 받기 = 재료 스탬프 소진])
            UC22([쿠폰 사용 내역 조회])
        end

        subgraph adminOps["적립 항목·혜택 관리"]
            UC30([적립 항목 등록/수정])
            UC31([적립 항목 상태 관리])
            UC32([적립 확인 처리])
            UC33([혜택 등록/수정])
            UC34([혜택 상태 관리])
        end
    end

    customer --> UC01
    customer --> UC02
    customer --> UC03
    customer --> UC04
    customer --> UC05
    customer --> UC10
    customer --> UC11
    customer --> UC12
    customer --> UC13
    customer --> UC15
    customer --> UC20
    customer --> UC21
    customer --> UC22

    admin --> UC02
    admin --> UC03
    admin --> UC04
    admin --> UC05
    admin --> UC30
    admin --> UC31
    admin --> UC32
    admin --> UC33
    admin --> UC34

    UC11 -. include .-> UC02
    UC13 -. include .-> UC14
    UC32 -. include .-> UC13
    UC21 -. include .-> UC15
```

## 범례
- `-->` : 액터가 수행하는 유스케이스
- `-. include .->` : 한 유스케이스가 다른 유스케이스를 반드시 포함/유발함
  - 적립 요청/자세히 보기는 로그인 상태를 전제로 한다
  - 적립 확인 처리는 스탬프 적립으로 이어진다 (7장 규칙: 조합당 1회)
  - 관리자의 확인 처리는 거래처 담당자 쪽의 적립 확인 처리와 동일 흐름을 확정한다
  - 쿠폰 받기는 레시피에 명시된 모든 재료 종류를 필요 수량 이상 보유하고 있는지 확인을 전제로 한다 (`1-domain-definition.md` v1.2 Reward.recipe 참고)

> UC13(적립 확인 처리)은 거래처 담당자의 테스트용 셀프 확인과 관리자 확인 두 경로 모두로 도달 가능하다 (도메인 정의서 7장: "테스트용 완료 처리 또는 관리자 확인"). customer→UC13과 admin→UC32-.include.->UC13이 같은 처리 로직을 공유한다.
