import { useStampBalance, useStampHistory } from '../../hooks/useStamps';
import { getIngredientIcon } from '../../utils/ingredientIcon';
import '../missions/missions.css'; // participation-table 재사용
import './stamps.css';

function AmountCell({ type, amount }: { type: string; amount: number }) {
  const sign = type === 'EARN' ? '+' : '-';
  return <span className={type === 'EARN' ? 'text-success' : 'text-danger'}>{sign}{amount}</span>;
}

export default function StampsPage() {
  const { data: balances, isLoading: balanceLoading, isError: balanceError } = useStampBalance();
  const { data: history, isLoading: historyLoading, isError: historyError } = useStampHistory();

  if (balanceLoading || historyLoading) return <div>불러오는 중...</div>;
  if (balanceError || historyError) return <div style={{ color: '#e5484d' }}>정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  return (
    <div>
      <section className="page-section">
        <h2>스탬프 보유 현황</h2>
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
        <h2>이용 내역</h2>
        {!history || history.length === 0 ? (
          <p>이용 내역이 없습니다</p>
        ) : (
          <table className="participation-table">
            <thead>
              <tr><th>일시</th><th>종류</th><th>구분</th><th>수량</th><th>사유</th></tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.transactionId}>
                  <td data-label="일시">{h.createdAt}</td>
                  <td data-label="종류">{getIngredientIcon(h.ingredientType)} {h.ingredientType}</td>
                  <td data-label="구분">{h.type === 'EARN' ? '적립' : '차감'}</td>
                  <td data-label="수량"><AmountCell type={h.type} amount={h.amount} /></td>
                  <td data-label="사유">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
