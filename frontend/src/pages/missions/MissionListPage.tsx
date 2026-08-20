import { Link } from 'react-router';
import { useMissions } from '../../hooks/useMissions';
import type { MissionStatus } from '../../types/domain';
import './missions.css';

const STATUS_LABEL: Record<MissionStatus, string> = { PENDING: '예정', ACTIVE: '진행중', ENDED: '종료' };

const PARTICIPATION_LABEL = { JOINED: '참여함', COMPLETED: '완료' };

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export default function MissionListPage() {
  const { data: missions, isLoading, isError } = useMissions();

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  const visible = (missions || []).filter((m) => m.status !== 'ENDED');

  if (visible.length === 0) return <div>진행중이거나 예정된 미션이 없습니다.</div>;

  return (
    <div className="mission-grid">
      {visible.map((m) => (
        <Link key={m.missionId} to={`/missions/${m.missionId}`} className="mission-card">
          <span className={`status-badge ${m.status === 'ACTIVE' ? '' : 'muted'}`}>{STATUS_LABEL[m.status]}</span>
          <h3>{m.title}</h3>
          <p>지급 스탬프: {m.ingredientType} {m.stampCount}개</p>
          <p>{formatDate(m.startAt)} ~ {formatDate(m.endAt)}</p>
          {m.participationStatus && <p>{PARTICIPATION_LABEL[m.participationStatus]}</p>}
        </Link>
      ))}
    </div>
  );
}
