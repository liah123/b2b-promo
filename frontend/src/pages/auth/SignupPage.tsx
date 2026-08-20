import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import AuthLayout from './AuthLayout';
import { useSignup } from '../../hooks/useAuth';

export default function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signup.mutate(
      { email, password, name },
      { onSuccess: () => navigate('/login') },
    );
  }

  return (
    <AuthLayout active="signup">
      <form className="auth-form" onSubmit={handleSubmit}>
        {signup.isError && <p className="auth-error">{signup.error.message}</p>}
        <div className="auth-field">
          <label className="auth-label" htmlFor="name">이름</label>
          <input
            id="name"
            className="auth-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            required
          />
        </div>
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
            placeholder="8자 이상"
            minLength={8}
            required
          />
        </div>
        <button className="auth-submit" type="submit" disabled={signup.isPending}>
          회원가입
        </button>
      </form>
    </AuthLayout>
  );
}
