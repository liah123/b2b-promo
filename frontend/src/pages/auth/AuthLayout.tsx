import type { ReactNode } from 'react';
import { Link } from 'react-router';
import './auth.css';

interface AuthLayoutProps {
  active: 'login' | 'signup';
  children: ReactNode;
}

export default function AuthLayout({ active, children }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-tabs">
          <Link to="/login" className={active === 'login' ? 'auth-tab auth-tab-active' : 'auth-tab'}>
            로그인
          </Link>
          <Link to="/signup" className={active === 'signup' ? 'auth-tab auth-tab-active' : 'auth-tab'}>
            회원가입
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
