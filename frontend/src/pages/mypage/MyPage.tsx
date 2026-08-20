import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useUpdateMe, useUpdatePassword } from '../../hooks/useUser';
import '../auth/auth.css';
import '../stamps/stamps.css';

export default function MyPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const updateMe = useUpdateMe();
  const updatePassword = useUpdatePassword();

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe.mutate({ name }, { onSuccess: (updatedUser) => setUser(updatedUser) });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePassword.mutate(
      { currentPassword, newPassword },
      { onSuccess: () => { setCurrentPassword(''); setNewPassword(''); } }
    );
  };

  return (
    <div>
      <h2>마이페이지</h2>
      <section>
        <h3>내 정보</h3>
        <p>이메일: {user?.email}</p>
        <form onSubmit={handleNameSubmit} className="auth-form">
          <label className="auth-label">이름</label>
          <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} required />
          {updateMe.isError && <p className="auth-error">{updateMe.error.message}</p>}
          <button className="auth-submit" type="submit" disabled={updateMe.isPending}>저장</button>
        </form>
      </section>
      <section>
        <h3>비밀번호 변경</h3>
        <form onSubmit={handlePasswordSubmit} className="auth-form">
          <label className="auth-label">현재 비밀번호</label>
          <input className="auth-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          <label className="auth-label">새 비밀번호</label>
          <input className="auth-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          {updatePassword.isError && <p className="auth-error">{updatePassword.error.message}</p>}
          {updatePassword.isSuccess && <p className="text-success">비밀번호가 변경되었습니다</p>}
          <button className="auth-submit" type="submit" disabled={updatePassword.isPending}>변경하기</button>
        </form>
      </section>
    </div>
  );
}
