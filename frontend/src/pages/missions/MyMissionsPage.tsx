import { useMission } from '../../hooks/useMissions';
import { useCompleteParticipation, useMyParticipations } from '../../hooks/useParticipations';
import type { MissionParticipation } from '../../types/domain';
import './missions.css';

function CompletedRow({ p }: { p: MissionParticipation }) {
  const { data: mission } = useMission(p.missionId);
  return (
    <tr>
      <td data-label="미션명">{p.missionTitle}</td>
      <td data-label="완료일">{p.completedAt}</td>
      <td data-label="지급 스탬프">{mission ? `${mission.ingredientType} ${mission.stampCount}개` : '-'}</td>
    </tr>
  );
}

export default function MyMissionsPage() {
  const { data: list, isLoading, isError } = useMyParticipations();
  const complete = useCompleteParticipation();

  const joined = list?.filter((p) => p.status === 'JOINED') ?? [];
  const completed = list?.filter((p) => p.status === 'COMPLETED') ?? [];

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  return (
    <div>
      <h2>직원 확인 대기</h2>
      {joined.length === 0 ? (
        <p>표시할 항목이 없습니다</p>
      ) : (
        <table className="participation-table">
          <thead>
            <tr>
              <th>미션명</th>
              <th>요청일</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {joined.map((p) => {
              const isPendingRow = complete.isPending && complete.variables === p.participationId;
              const isErrorRow = complete.isError && complete.variables === p.participationId;
              return (
                <tr key={p.participationId}>
                  <td data-label="미션명">{p.missionTitle}</td>
                  <td data-label="요청일">{p.joinedAt}</td>
                  <td data-label="">
                    <button disabled={isPendingRow} onClick={() => complete.mutate(p.participationId)}>
                      확인 요청
                    </button>
                    {isErrorRow && <div>{complete.error?.message}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h2>적립 완료</h2>
      {completed.length === 0 ? (
        <p>표시할 항목이 없습니다</p>
      ) : (
        <table className="participation-table">
          <thead>
            <tr>
              <th>미션명</th>
              <th>완료일</th>
              <th>지급 스탬프</th>
            </tr>
          </thead>
          <tbody>
            {completed.map((p) => (
              <CompletedRow key={p.participationId} p={p} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
