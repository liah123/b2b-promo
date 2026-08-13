# 유스케이스 다이어그램 — Stamp Up

`1-domain-definition.md` 5장(유스케이스)을 기반으로 작성. Mermaid는 UML 유스케이스 다이어그램 전용 문법이 없어 `flowchart`로 액터·시스템 경계·유스케이스를 표현한다.

```mermaid
flowchart LR
    customer(["거래처 담당자<br/>(CUSTOMER)"])
    admin(["관리자<br/>(ADMIN)"])

    subgraph system["Stamp Up"]
        direction TB

        subgraph common["공통"]
            UC01([회원가입])
            UC02([로그인])
            UC03([마이페이지 조회/수정])
            UC04([비밀번호 변경])
        end

        subgraph mission["미션·스탬프"]
            UC10([미션 목록/상세 조회])
            UC11([미션 참여])
            UC12([참여/완료 미션 구분 조회])
            UC13([미션 완료 처리])
            UC14([재료 스탬프 획득])
            UC15([재료별 스탬프 보유량/이력 조회])
        end

        subgraph reward["리워드(요리)"]
            UC20([요리·레시피 목록 조회])
            UC21([요리 교환 = 재료 스탬프 소진])
            UC22([교환 내역 조회])
        end

        subgraph adminOps["미션·리워드 관리"]
            UC30([미션 등록/수정])
            UC31([미션 상태 관리])
            UC32([미션 완료 확인 처리])
            UC33([리워드 등록/수정])
            UC34([리워드 상태 관리])
        end
    end

    customer --> UC01
    customer --> UC02
    customer --> UC03
    customer --> UC04
    customer --> UC10
    customer --> UC11
    customer --> UC12
    customer --> UC15
    customer --> UC20
    customer --> UC21
    customer --> UC22

    admin --> UC02
    admin --> UC03
    admin --> UC04
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
  - 미션 참여는 로그인 상태를 전제로 한다
  - 미션 완료 처리는 스탬프 획득으로 이어진다 (7장 규칙: 조합당 1회)
  - 관리자의 완료 확인 처리는 거래처 담당자의 미션 완료 처리와 동일 흐름을 확정한다
  - 요리 교환은 레시피에 명시된 모든 재료 종류를 필요 수량 이상 보유하고 있는지 확인을 전제로 한다 (`1-domain-definition.md` v1.2 Reward.recipe 참고)
