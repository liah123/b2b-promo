import { useMyRedemptions } from '../../hooks/useRewards';
import { getDishIcon } from '../../utils/dishIcon';
import { getIngredientIcon } from '../../utils/ingredientIcon';
import '../missions/missions.css';

export default function MyRedemptionsPage() {
  const { data: redemptions, isLoading, isError } = useMyRedemptions();

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;
  if (!redemptions || redemptions.length === 0) return <p>교환 내역이 없습니다</p>;

  return (
    <div>
      <h2>쿠폰 사용 내역</h2>
      <table className="participation-table">
        <thead>
          <tr><th>일시</th><th>혜택명</th><th>사용된 스탬프</th></tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr key={r.redemptionId}>
              <td data-label="일시">{r.redeemedAt}</td>
              <td data-label="혜택명">{getDishIcon(r.rewardName ?? '')} {r.rewardName}</td>
              <td data-label="사용된 스탬프">
                {(r.usedIngredients ?? []).map((x) => `${getIngredientIcon(x.ingredientType)}${x.ingredientType}${x.quantity}`).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
