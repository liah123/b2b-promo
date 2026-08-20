import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import AuthLayout from './AuthLayout';
import { useLogin } from '../../hooks/useAuth';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: ({ user, accessToken }) => {
          useAuthStore.getState().setAuth(user, accessToken);
          navigate('/');
        },
      },
    );
  }

  return (
    <AuthLayout active="login">
      <form className="auth-form" onSubmit={handleSubmit}>
        {login.isError && <p className="auth-error">{login.error.message}</p>}
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">이메일</label>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">비밀번호</label>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            required
          />
        </div>
        <button className="auth-submit" type="submit" disabled={login.isPending}>
          로그인
        </button>
      </form>
    </AuthLayout>
  );
}
