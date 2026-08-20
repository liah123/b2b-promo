import { useParams } from 'react-router';
import { useMission } from '../../hooks/useMissions';
import { useJoinMission } from '../../hooks/useParticipations';
import { getIngredientIcon } from '../../utils/ingredientIcon';
import './missions.css';

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export default function MissionDetailPage() {
  const { missionId } = useParams();
  const { data: mission, isLoading, isError } = useMission(Number(missionId));
  const join = useJoinMission(Number(missionId));

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;
  if (!mission) return <div>미션을 찾을 수 없습니다.</div>;

  const canJoin = mission.status === 'ACTIVE' && !mission.participationStatus;
  const buttonLabel =
    mission.participationStatus === 'COMPLETED' ? '적립 완료' :
    mission.participationStatus === 'JOINED' ? '요청됨' :
    mission.status === 'PENDING' ? '예정' :
    mission.status === 'ENDED' ? '종료' :
    '적립 요청하기';

  return (
    <div>
      <h2>{mission.title}</h2>
      {mission.description && <p>{mission.description}</p>}
      <p>기간: {formatDate(mission.startAt)} ~ {formatDate(mission.endAt)}</p>
      {mission.completionCondition && <p>적립 조건: {mission.completionCondition}</p>}
      <p>지급 스탬프: {getIngredientIcon(mission.ingredientType)} {mission.ingredientType} {mission.stampCount}개</p>
      <button
        className="mission-cta"
        disabled={!canJoin || join.isPending}
        onClick={() => join.mutate()}
      >
        {buttonLabel}
      </button>
      {join.isError && <p style={{ color: '#e5484d', fontSize: 13 }}>{join.error.message}</p>}
    </div>
  );
}
