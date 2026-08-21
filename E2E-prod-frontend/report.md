# YumStamp 운영(Vercel) 프론트엔드 E2E 테스트 리포트

- 테스트 대상: `https://qwer-098-fe.vercel.app` (프론트엔드) + `https://qwer-098-be.vercel.app` (백엔드, Supabase 운영 DB 연동)
- 테스트 방식: Playwright MCP를 이용한 실제 브라우저 기반 시나리오 테스트
- 근거 문서: `docs/4-user-scenari.md`
- 테스트 일자: 2026-08-21
- 결과 요약: **전 시나리오 통과, 발견된 버그 없음** (배포 인프라 이슈는 테스트 이전 단계에서 모두 해결됨 — 하단 "배포 과정에서 발견/수정된 이슈" 참고)

## 시나리오별 결과

| # | 시나리오 | 결과 | 스크린샷 |
|---|---|---|---|
| 1 | 회원가입 | PASS | `01a-signup-form.png`, `01b-signup-success.png` |
| 2 | 로그인 / 홈 화면 | PASS | `02-home.png` |
| 3 | 적립 항목(미션) 목록 조회 | PASS | `03-missions-list.png` |
| 4 | 적립 항목 상세 조회 및 적립 요청 | PASS | `04a-mission-detail.png`, `04b-mission-requested.png` |
| 5 | 이용 내역(스탬프 보유 현황) 조회 | PASS | `05-stamps.png` |
| 6 | 혜택(쿠폰) 조회 및 교환 | PASS | `06a-rewards-list.png`, `06b-reward-redeemed.png` |
| 7 | 관리자 - 적립 항목 관리 화면 | PASS | `07a-admin-missions.png` |
| 8 | 관리자 - 적립 요청 확인 처리 | PASS | (화면 내 승인 처리로 시나리오 5의 스탬프 반영 확인) |
| 9 | 관리자 - 혜택 관리 화면 | PASS | `09a-admin-rewards.png` |
| 10 | 마이페이지(내 정보) 조회 | PASS | `10-mypage.png` |
| 11 | 쿠폰 사용 내역 조회 | PASS | `11-my-redemptions.png` |
| 12 | 모바일 하단 GNB 렌더링 | PASS | `12-mobile-bottom-gnb.png` |
| 13 | 예외 - 미인증 상태에서 관리자 페이지 접근 시 로그인으로 리다이렉트 | PASS | `13-exception-unauth-redirect.png` |
| 14 | 예외 - 이메일 중복 가입 / 잘못된 비밀번호 로그인 | PASS | `14-exception-duplicate-email.png`, `14-exception-wrong-password.png` |

## 주요 확인 사항

- 회원가입 → 로그인 → 미션 참여 신청 → 관리자 승인 → 스탬프 적립 → 혜택 교환 → 사용 내역 조회까지 전체 플로우가 운영 배포 환경(Vercel FE + Vercel BE + Supabase DB)에서 정상 동작함
- 재료/음식 이모지 아이콘(🧅🥕🥔🍛)이 미션/혜택 목록, 상세, 관리자 화면, 스탬프 현황 전반에 정상 표시됨
- 모바일 뷰포트(390×844)에서 상단 메뉴 대신 하단 GNB(탭바)가 정상 렌더링됨
- 미인증 사용자가 `/admin/missions`에 직접 접근하면 `/login`으로 리다이렉트됨
- 이메일 중복 가입 시도 및 잘못된 비밀번호 로그인 시 각각 적절한 에러 메시지가 표시됨

## 테스트 계정

- 신규 생성 고객: `e2e-fe-prod@example.com`
- 관리자: `admin@stampup.local`

## 배포 과정에서 발견/수정된 이슈 (테스트 이전 단계, 참고용)

이번 E2E 테스트를 시작하기 전, 프론트엔드 배포 과정에서 아래 이슈들이 발견되어 수정되었습니다. 모두 해결 완료된 상태에서 본 테스트를 진행했습니다.

1. 프론트엔드 API 클라이언트에 `http://localhost:3000`이 하드코딩되어 있던 버그 → `VITE_API_BASE_URL` 환경변수 사용하도록 수정 (커밋 반영)
2. Vercel 환경변수 `VITE_API_BASE_URL` 값 오설정(프로토콜/포트 오류) 및 빌드 캐시로 인한 재배포 미반영
3. 백엔드 Vercel 환경변수 `FRONTEND_ORIGIN`이 이전 값으로 남아있어 발생한 CORS 차단

위 이슈는 사용자가 Vercel 대시보드에서 직접 수정/재배포하였고, 각 수정 후 curl 기반 CORS 프리플라이트 확인 및 실제 브라우저 로그인 테스트로 해결을 검증했습니다.

## 비고

- 운영 DB에 본 테스트로 생성된 테스트 데이터(`운영 E2E` 접두사 미션/혜택, `e2e-fe-prod@example.com` 등 테스트 계정)가 남아있습니다. 필요 시 정리 요청해 주세요.
