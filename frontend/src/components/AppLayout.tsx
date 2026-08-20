import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuthStore } from '../store/authStore';
import { useLogout } from '../hooks/useAuth';
import './nav.css';

const customerLinks = [
  { to: '/', label: '홈' },
  { to: '/missions', label: '적립 안내' },
  { to: '/rewards', label: '쿠폰/혜택' },
  { to: '/stamps', label: '이용 내역' },
  { to: '/mypage', label: '마이페이지' },
];
const adminLinks = [
  { to: '/admin/missions', label: '적립 항목 관리' },
  { to: '/admin/rewards', label: '혜택 관리' },
  { to: '/mypage', label: '마이페이지' },
];

export default function AppLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const links = user?.role === 'ADMIN' ? adminLinks : customerLinks;

  return (
    <>
      <header className="app-header">
        <span className="app-brand">Stamp Up</span>
        <button className="app-menu-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? '닫기' : '메뉴'}
        </button>
        <nav className={`app-nav${open ? ' open' : ''}`}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
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
    </>
  );
}
