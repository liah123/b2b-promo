# YumStamp 운영(Vercel) 회귀 E2E 테스트 리포트

- 테스트 대상: `https://qwer-098-fe.vercel.app` (프론트엔드) + `https://qwer-098-be.vercel.app` (백엔드, Supabase 운영 DB)
- 테스트 방식: Playwright MCP를 이용한 실제 브라우저 기반 회귀 테스트
- 테스트 일자: 2026-08-21
- 목적: 로컬에서 검증한 UI 개선사항(헤더 여백, 카드형 섹션, 버튼형 링크, 행위 중심 미션명, 쿠폰 스타일 리워드명)이 운영 배포(Vercel 자동 배포)에도 동일하게 반영됐는지 확인
- 결과 요약: **전 항목 PASS**

## 확인 항목

| # | 항목 | 결과 | 스크린샷 |
|---|---|---|---|
| 1 | 데모 계정 로그인 및 홈 화면 — 헤더 여백, 카드형 섹션, 버튼형 "전체보기 ›" | PASS | `01-home.png` |
| 2 | 미션 목록에 행위 중심 명칭 반영 ("신선 당근 구매하기", "행사 양파 구매하기" 등) | PASS | `02-missions-list.png` |
| 3 | 미션 참여 요청 → 관리자 참여자 목록 조회 | PASS | `03-admin-missions.png`, `04-admin-participants.png` |
| 4 | 관리자 적립 확인 처리 → 고객 스탬프 반영 및 "카레처럼 든든한 1,000원 할인 쿠폰"(🍛) 노출 | PASS | `05-home-with-stamps.png` |
| 5 | 혜택 교환("쿠폰 받기") 및 스탬프 차감 | PASS | `06-reward-redeemed.png` |
| 6 | 쿠폰 사용 내역에 변경된 혜택명 반영 | PASS | `07-my-redemptions.png` |
| 7 | 모바일(390×844) 하단 GNB 렌더링 | PASS | `08-mobile-bottom-gnb.png` |
| 8 | 예외 — 잘못된 비밀번호 로그인 시 에러 메시지 | PASS | `09-exception-wrong-password.png` |

## 주요 확인 사항

- 최근 커밋(헤더 여백, `page-section` 카드, 버튼형 섹션 링크, 미션/리워드 문구 변경)이 Vercel 자동 배포를 통해 운영 프론트엔드에 정상 반영됨
- 운영 DB의 미션/리워드 명칭도 로컬과 동일하게 자연스러운 문구로 갱신되어 있고, 화면에도 올바르게 표시됨
- README에 추가한 데모 계정(`demo@yumstamp.local`)으로 실제 회원가입~로그인~미션참여~교환 전체 플로우가 정상 동작함을 확인

## 참고 (테스트 진행 중 발견한 사소한 이슈)

- 관리자 "적립 항목 관리" 화면에서 Playwright의 접근성 스냅샷 기준 `ref` 클릭이 운영 환경 응답 지연 때문인지 간헐적으로 씹혀, DOM 텍스트 매칭 방식으로 재시도해야 했음. 실제 사용자의 일반적인 마우스 클릭에는 영향이 없는, 테스트 자동화 관점의 특이사항으로 판단됨(버그 아님).

## 테스트 계정

- 고객: `demo@yumstamp.local` / `demo1234` (README 데모 계정)
- 관리자: `admin@stampup.local`
