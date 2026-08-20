import { useState } from 'react';
import { useCreateReward, useRewards, useUpdateReward, useUpdateRewardStatus } from '../../hooks/useRewards';
import type { Reward, RewardCreateRequest, RecipeItem } from '../../types/domain';
import { getDishIcon } from '../../utils/dishIcon';
import { getIngredientIcon } from '../../utils/ingredientIcon';
import '../missions/missions.css';

const STATUS_LABEL: Record<'ACTIVE' | 'INACTIVE', string> = { ACTIVE: '활성', INACTIVE: '비활성' };

const EMPTY_RECIPE: RecipeItem[] = [{ ingredientType: '', quantity: 1 }];

function RewardForm({ editingReward, onSubmit, onCancel, isPending, serverError }: {
  editingReward: Reward | null;
  onSubmit: (body: RewardCreateRequest) => void;
  onCancel: () => void;
  isPending: boolean;
  serverError?: string;
}) {
  const [name, setName] = useState(editingReward?.name ?? '');
  const [description, setDescription] = useState(editingReward?.description ?? '');
  const [recipe, setRecipe] = useState<RecipeItem[]>(editingReward?.recipe ?? EMPTY_RECIPE);
  const [localError, setLocalError] = useState<string | null>(null);

  const updateRecipeRow = (idx: number, patch: Partial<RecipeItem>) => {
    setRecipe(recipe.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRecipeRow = (idx: number) => {
    setRecipe(recipe.filter((_, i) => i !== idx));
  };
  const addRecipeRow = () => {
    setRecipe([...recipe, { ingredientType: '', quantity: 1 }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recipe.length === 0 || recipe.some((r) => !r.ingredientType || r.quantity < 1)) {
      setLocalError('필요 스탬프를 1개 이상 올바르게 입력하세요');
      return;
    }
    setLocalError(null);
    onSubmit({ name, description, recipe });
  };

  return (
    <form
      className="participation-table"
      style={{ display: 'block', padding: 16 }}
      onSubmit={handleSubmit}
    >
      <div>
        <label>혜택명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label>설명</label>
        <input value={description ?? ''} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label>필요 스탬프</label>
        {recipe.map((r, idx) => (
          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              placeholder="종류"
              value={r.ingredientType}
              onChange={(e) => updateRecipeRow(idx, { ingredientType: e.target.value })}
            />
            <input
              type="number"
              min={1}
              value={r.quantity}
              onChange={(e) => updateRecipeRow(idx, { quantity: Number(e.target.value) })}
            />
            {recipe.length > 1 && (
              <button type="button" onClick={() => removeRecipeRow(idx)}>삭제</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addRecipeRow}>+ 스탬프 추가</button>
      </div>
      {(localError || serverError) && <p style={{ color: 'red' }}>{localError || serverError}</p>}
      <button type="submit" disabled={isPending}>저장</button>
      <button type="button" onClick={onCancel}>취소</button>
    </form>
  );
}

export default function RewardManagePage() {
  const { data: rewards, isLoading, isError } = useRewards();
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const updateStatus = useUpdateRewardStatus();

  if (isLoading) return <div>불러오는 중...</div>;
  if (isError) return <div style={{ color: '#e5484d' }}>목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;

  // pg bigint(reward_id)가 문자열로 내려오므로 editingId는 'new' 여부로만 신규/수정을 구분한다.
  const isEditingExisting = editingId !== null && editingId !== 'new';
  const editingReward = isEditingExisting
    ? rewards?.find((r) => String(r.rewardId) === String(editingId)) ?? null
    : null;

  const handleSubmit = (body: RewardCreateRequest) => {
    if (editingId === 'new') {
      createReward.mutate(body, { onSuccess: () => setEditingId(null) });
    } else if (isEditingExisting) {
      updateReward.mutate({ rewardId: editingId as number, body }, { onSuccess: () => setEditingId(null) });
    }
  };

  return (
    <div>
      <h2>혜택 관리</h2>

      {editingId === null && (
        <button onClick={() => setEditingId('new')}>+ 혜택 등록</button>
      )}

      {editingId !== null && (
        <RewardForm
          editingReward={editingReward}
          onSubmit={handleSubmit}
          onCancel={() => setEditingId(null)}
          isPending={createReward.isPending || updateReward.isPending}
          serverError={(createReward.error || updateReward.error)?.message}
        />
      )}

      <table className="participation-table">
        <thead>
          <tr>
            <th>혜택명</th>
            <th>필요 스탬프</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          {(rewards ?? []).map((r) => (
            <tr key={r.rewardId}>
              <td data-label="혜택명">{getDishIcon(r.name)} {r.name}</td>
              <td data-label="필요 스탬프">{r.recipe.map((x) => `${getIngredientIcon(x.ingredientType)}${x.ingredientType}${x.quantity}`).join(', ')}</td>
              <td data-label="상태">
                <span className={`status-badge ${r.status === 'ACTIVE' ? '' : 'muted'}`}>{STATUS_LABEL[r.status]}</span>
              </td>
              <td data-label="관리">
                <button onClick={() => setEditingId(r.rewardId)}>수정</button>
                <button
                  disabled={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ rewardId: r.rewardId, status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
                >
                  {r.status === 'ACTIVE' ? '비활성화' : '활성화'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
