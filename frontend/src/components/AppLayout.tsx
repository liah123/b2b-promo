import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import './nav.css';

const customerLinks = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/missions', label: '적립 안내', icon: '🎯' },
  { to: '/rewards', label: '쿠폰/혜택', icon: '🎁' },
  { to: '/stamps', label: '이용 내역', icon: '🧾' },
  { to: '/mypage', label: '마이페이지', icon: '👤' },
];
const adminLinks = [
  { to: '/admin/missions', label: '적립 항목 관리', icon: '🎯' },
  { to: '/admin/rewards', label: '혜택 관리', icon: '🎁' },
  { to: '/mypage', label: '마이페이지', icon: '👤' },
];

export default function AppLayout({ children }: { children?: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const isAdmin = user?.role === 'ADMIN';
  const links = isAdmin ? adminLinks : customerLinks;

  return (
    <>
      <header className="app-header">
        <span className="app-brand">YumStamp</span>
        {/* 데스크탑 상단 내비 — 모바일에서는 하단 GNB(app-bottom-nav)로 대체되어 숨김 처리됨 */}
        <nav className="app-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="app-logout"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          로그아웃
        </button>
      </header>
      <main className="app-main">{children ?? <Outlet />}</main>
      {/* 모바일 전용 하단 GNB — 관리자 화면은 데스크탑 전용이라 제외 */}
      {!isAdmin && (
        <nav className="app-bottom-nav">
          {customerLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `app-bottom-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="app-bottom-nav-icon">{link.icon}</span>
              <span className="app-bottom-nav-label">{link.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}
