import { Link } from 'react-router';
import { useAuthStore } from '../../store/authStore';
import { useStampBalance, useStampHistory } from '../../hooks/useStamps';
import { useRewards, useRedeemReward } from '../../hooks/useRewards';
import { getIngredientIcon } from '../../utils/ingredientIcon';
import { getDishIcon } from '../../utils/dishIcon';
import '../missions/missions.css';
import '../stamps/stamps.css';

export default function StampHomePage() {
  const user = useAuthStore((s) => s.user);
  const { data: balances, isLoading: balanceLoading, isError: balanceError } = useStampBalance();
  const { data: history, isLoading: historyLoading, isError: historyError } = useStampHistory();
  const { data: rewards, isLoading: rewardsLoading, isError: rewardsError } = useRewards();
  const redeem = useRedeemReward();

  if (balanceLoading || historyLoading || rewardsLoading) return <div>불러오는 중...</div>;
  if (balanceError || historyError || rewardsError) return <div style={{ color: '#e5484d' }}>정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  const redeemableRewards = (rewards ?? []).filter((r) => r.canRedeem).slice(0, 3);
  const recentHistory = (history ?? []).slice(0, 3);

  return (
    <div>
      <h2>{user?.name}님, 안녕하세요</h2>

      <section className="page-section">
        <div className="page-section-header">
          <h3>보유 스탬프 요약</h3>
          <Link to="/stamps" className="page-section-link">전체보기 ›</Link>
        </div>
        {!balances || balances.length === 0 ? (
          <p>보유한 스탬프가 없습니다</p>
        ) : (
          <div className="stamp-balance-scroll">
            {balances.map((b) => (
              <div key={b.ingredientType} className="stamp-balance-card">
                <div className="stamp-balance-icon">{getIngredientIcon(b.ingredientType)}</div>
                <div className="stamp-balance-type">{b.ingredientType}</div>
                <div className="stamp-balance-count">{b.balance}개</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="page-section">
        <div className="page-section-header">
          <h3>지금 받을 수 있는 혜택</h3>
          <Link to="/rewards" className="page-section-link">전체보기 ›</Link>
        </div>
        {redeemableRewards.length === 0 ? (
          <p>지금 받을 수 있는 혜택이 없습니다</p>
        ) : (
          <div className="mission-grid">
            {redeemableRewards.map((r) => (
              <div key={r.rewardId} className="mission-card">
                <div className="mission-card-icon">{getDishIcon(r.name)}</div>
                <h4>{r.name}</h4>
                <p>필요 스탬프: {r.recipe.map((x) => `${getIngredientIcon(x.ingredientType)}${x.ingredientType}${x.quantity}`).join(', ')}</p>
                <button
                  className="mission-cta"
                  disabled={redeem.isPending}
                  onClick={() => redeem.mutate(r.rewardId)}
                >
                  쿠폰 받기
                </button>
                {redeem.variables === r.rewardId && redeem.isSuccess && <p className="text-success">교환되었습니다!</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="page-section">
        <div className="page-section-header">
          <h3>최근 이용 내역</h3>
          <Link to="/stamps" className="page-section-link">전체보기 ›</Link>
        </div>
        {recentHistory.length === 0 ? (
          <p>이용 내역이 없습니다</p>
        ) : (
          <table className="participation-table">
            <thead>
              <tr><th>일시</th><th>종류</th><th>구분</th><th>수량</th></tr>
            </thead>
            <tbody>
              {recentHistory.map((h) => (
                <tr key={h.transactionId}>
                  <td data-label="일시">{h.createdAt}</td>
                  <td data-label="종류">{getIngredientIcon(h.ingredientType)} {h.ingredientType}</td>
                  <td data-label="구분">{h.type === 'EARN' ? '적립' : '차감'}</td>
                  <td data-label="수량">
                    <span className={h.type === 'EARN' ? 'text-success' : 'text-danger'}>
                      {h.type === 'EARN' ? '+' : '-'}{h.amount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
