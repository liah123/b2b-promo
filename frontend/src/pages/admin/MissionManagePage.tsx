import { Fragment, useState } from 'react';
import { useCreateMission, useMissions, useUpdateMission, useUpdateMissionStatus } from '../../hooks/useMissions';
import { useConfirmParticipation, useMissionParticipations } from '../../hooks/useParticipations';
import type { Mission, MissionCreateRequest, MissionStatus, ParticipationStatus } from '../../types/domain';
import '../missions/missions.css';

const STATUS_LABEL: Record<MissionStatus, string> = { PENDING: '예정', ACTIVE: '진행중', ENDED: '종료' };
const PARTICIPATION_STATUS_LABEL: Record<ParticipationStatus, string> = { JOINED: '참여중', COMPLETED: '완료' };

const EMPTY_FORM: MissionCreateRequest = {
  title: '', description: '', startAt: '', endAt: '',
  completionCondition: '', ingredientType: '', stampCount: 1,
};

function toFormData(m: Mission): MissionCreateRequest {
  return {
    title: m.title, description: m.description ?? '',
    startAt: m.startAt.slice(0, 10), endAt: m.endAt.slice(0, 10),
    completionCondition: m.completionCondition ?? '',
    ingredientType: m.ingredientType, stampCount: m.stampCount,
  };
}

function MissionForm({ initial, onSubmit, onCancel, isPending }: {
  initial: MissionCreateRequest;
  onSubmit: (body: MissionCreateRequest) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<MissionCreateRequest>(initial);

  return (
    <form
      className="participation-table"
      style={{ display: 'block', padding: 16 }}
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
    >
      <div>
        <label>항목명</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </div>
      <div>
        <label>설명</label>
        <input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <label>시작일</label>
        <input type="date" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
      </div>
      <div>
        <label>종료일</label>
        <input type="date" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required />
      </div>
      <div>
        <label>완료 조건</label>
        <input value={form.completionCondition ?? ''} onChange={(e) => setForm({ ...form, completionCondition: e.target.value })} />
      </div>
      <div>
        <label>스탬프 종류</label>
        <input value={form.ingredientType} onChange={(e) => setForm({ ...form, ingredientType: e.target.value })} required />
      </div>
      <div>
        <label>지급 개수</label>
        <input type="number" min={1} value={form.stampCount} onChange={(e) => setForm({ ...form, stampCount: Number(e.target.value) })} required />
      </div>
      <button type="submit" disabled={isPending}>저장</button>
      <button type="button" onClick={onCancel}>취소</button>
    </form>
  );
}

function ParticipantRows({ missionId }: { missionId: number }) {
  const { data: participants, isLoading, isError } = useMissionParticipations(missionId);
  const confirm = useConfirmParticipation();

  if (isLoading) return <tr><td colSpan={4}>불러오는 중...</td></tr>;
  if (isError) return <tr><td colSpan={4}>참여자 목록을 불러오지 못했습니다</td></tr>;
  if (!participants || participants.length === 0) {
    return <tr><td colSpan={4}>참여자가 없습니다</td></tr>;
  }

  return (
    <>
      {participants.map((p) => (
        <tr key={p.participationId}>
          <td data-label="이름">{p.userName}</td>
          <td data-label="이메일">{p.userEmail}</td>
          <td data-label="상태">{PARTICIPATION_STATUS_LABEL[p.status]}</td>
          <td data-label="">
            {p.status === 'JOINED' && (
              <button disabled={confirm.isPending} onClick={() => confirm.mutate(p.participationId)}>
                적립 확인 처리
              </button>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

export default function MissionManagePage() {
  const { data: missions, isLoading, isError } = useMissions();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [expandedMissionId, setExpandedMissionId] = useState<number | null>(null);

  const createMission = useCreateMission();
  const updateMission = useUpdateMission();
  const updateStatus = useUpdateMissionStatus();

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  // pg가 bigint(mission_id)를 문자열로 내려주므로 missionId는 실제로는 string이다(도메인 타입은 number로 선언돼 있지만
  // 런타임 값은 문자열). typeof 비교 대신 'new' 여부로만 신규/수정을 구분한다.
  const isEditingExisting = editingId !== null && editingId !== 'new';
  const editingMission = isEditingExisting
    ? missions?.find((m) => String(m.missionId) === String(editingId))
    : null;

  const handleSubmit = (formBody: MissionCreateRequest) => {
    // 날짜 입력값(YYYY-MM-DD)은 UTC 자정으로 명시해 전송 — 안 그러면 서버가 세션 타임존(KST)으로 해석해 하루 당겨진다.
    const body: MissionCreateRequest = {
      ...formBody,
      startAt: `${formBody.startAt}T00:00:00.000Z`,
      endAt: `${formBody.endAt}T00:00:00.000Z`,
    };
    if (editingId === 'new') {
      createMission.mutate(body, { onSuccess: () => setEditingId(null) });
    } else if (isEditingExisting) {
      updateMission.mutate({ missionId: editingId as number, body }, { onSuccess: () => setEditingId(null) });
    }
  };

  const handleEnd = (missionId: number) => {
    if (window.confirm('정말 종료하시겠습니까?')) {
      updateStatus.mutate(missionId);
    }
  };

  return (
    <div>
      <h2>적립 항목 관리</h2>

      {editingId === null && (
        <button onClick={() => setEditingId('new')}>+ 적립 항목 등록</button>
      )}

      {editingId !== null && (
        <MissionForm
          initial={editingMission ? toFormData(editingMission) : EMPTY_FORM}
          onSubmit={handleSubmit}
          onCancel={() => setEditingId(null)}
          isPending={createMission.isPending || updateMission.isPending}
        />
      )}

      <table className="participation-table">
        <thead>
          <tr>
            <th>항목명</th>
            <th>상태</th>
            <th>기간</th>
            <th>지급 스탬프</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {(missions ?? []).map((m) => (
            <Fragment key={m.missionId}>
              <tr>
                <td data-label="항목명">{m.title}</td>
                <td data-label="상태">
                  <span className={`status-badge ${m.status === 'ACTIVE' ? '' : 'muted'}`}>{STATUS_LABEL[m.status]}</span>
                </td>
                <td data-label="기간">{m.startAt.slice(0, 10)} ~ {m.endAt.slice(0, 10)}</td>
                <td data-label="지급 스탬프">{m.ingredientType} {m.stampCount}개</td>
                <td data-label="관리">
                  <button onClick={() => setEditingId(m.missionId)}>수정</button>
                  {m.status === 'ACTIVE' && (
                    <button onClick={() => handleEnd(m.missionId)}>종료</button>
                  )}
                  <button onClick={() => setExpandedMissionId(expandedMissionId === m.missionId ? null : m.missionId)}>
                    참여자 목록
                  </button>
                </td>
              </tr>
              {expandedMissionId === m.missionId && (
                <tr>
                  <td colSpan={5}>
                    <table className="participation-table">
                      <thead>
                        <tr>
                          <th>이름</th>
                          <th>이메일</th>
                          <th>상태</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        <ParticipantRows missionId={m.missionId} />
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
