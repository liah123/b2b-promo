// 재료 종류(ingredientType)는 관리자가 자유 텍스트로 입력하는 값이라 고정 enum이 아니다.
// 자주 쓰이는 재료는 귀여운 일러스트 느낌의 이모지로 매핑하고, 목록에 없는 값은 기본 아이콘으로 대체한다.
const INGREDIENT_ICONS: Record<string, string> = {
  양파: '🧅', 당근: '🥕', 감자: '🥔', 고구마: '🍠', 옥수수: '🌽',
  양상추: '🥬', 배추: '🥬', 토마토: '🍅', 마늘: '🧄', 생강: '🫚',
  버섯: '🍄', 브로콜리: '🥦', 고추: '🌶️', 오이: '🥒', 가지: '🍆',
  호박: '🎃', 파: '🌿', 계란: '🥚', 새우: '🦐', 치즈: '🧀', 쌀: '🌾',
};
const DEFAULT_ICON = '🥬';

export function getIngredientIcon(ingredientType: string): string {
  return INGREDIENT_ICONS[ingredientType] ?? DEFAULT_ICON;
}
