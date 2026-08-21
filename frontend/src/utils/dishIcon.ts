// 혜택(Reward.name)도 재료와 마찬가지로 관리자가 자유 텍스트로 입력하는 요리명이라 고정 enum이 아니다.
// 자주 쓰이는 요리는 귀여운 일러스트 느낌의 이모지로 매핑하고, 목록에 없는 값은 기본 아이콘으로 대체한다.
const DISH_ICONS: Record<string, string> = {
  무료배송: '🚚', 할인: '🏷️', 적립금: '💰', 쿠폰: '🎟️',
  카레: '🍛', 김치찌개: '🍲', 된장찌개: '🥘', 비빔밥: '🍚', 떡볶이: '🍢',
  라면: '🍜', 파스타: '🍝', 피자: '🍕', 버거: '🍔', 샐러드: '🥗',
  볶음밥: '🍳', 잡채: '🥡', 만두: '🥟', 초밥: '🍣', 치킨: '🍗',
  삼겹살: '🥓', 갈비: '🍖', 스프: '🍜', 죽: '🥣', 국밥: '🍲',
};
const DEFAULT_ICON = '🍽️';

export function getDishIcon(name: string): string {
  const matched = Object.keys(DISH_ICONS).find((keyword) => name.includes(keyword));
  return matched ? DISH_ICONS[matched] : DEFAULT_ICON;
}
