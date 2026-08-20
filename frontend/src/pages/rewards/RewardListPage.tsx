import { useRewards, useRedeemReward } from '../../hooks/useRewards';
import '../missions/missions.css';
import '../stamps/stamps.css';

export default function RewardListPage() {
  const { data: rewards, isLoading, isError } = useRewards();
  const redeem = useRedeemReward();

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;
  if (!rewards || rewards.length === 0) return <div>받을 수 있는 혜택이 없습니다.</div>;

  return (
    <div className="mission-grid">
      {rewards.map((r) => {
        const isThisCard = redeem.variables === r.rewardId;
        return (
          <div key={r.rewardId} className="mission-card">
            <span className={`status-badge ${r.canRedeem ? '' : 'muted'}`}>
              {r.canRedeem ? '받을 수 있음' : '받을 수 없음'}
            </span>
            <h3>{r.name}</h3>
            {r.description && <p>{r.description}</p>}
            <p>필요 스탬프: {r.recipe.map((x) => `${x.ingredientType}${x.quantity}`).join(', ')}</p>
            <button
              className="mission-cta"
              disabled={!r.canRedeem || redeem.isPending}
              onClick={() => redeem.mutate(r.rewardId)}
            >
              쿠폰 받기
            </button>
            {isThisCard && redeem.isSuccess && <p className="text-success">교환되었습니다!</p>}
            {isThisCard && redeem.isError && <p style={{ color: '#e5484d', fontSize: 13 }}>{redeem.error.message}</p>}
          </div>
        );
      })}
    </div>
  );
}
