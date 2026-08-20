import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import StampHomePage from '../pages/home/StampHomePage';
import MissionListPage from '../pages/missions/MissionListPage';
import MissionDetailPage from '../pages/missions/MissionDetailPage';
import MyMissionsPage from '../pages/missions/MyMissionsPage';
import StampsPage from '../pages/stamps/StampsPage';
import RewardListPage from '../pages/rewards/RewardListPage';
import MyRedemptionsPage from '../pages/rewards/MyRedemptionsPage';
import MyPage from '../pages/mypage/MyPage';
import MissionManagePage from '../pages/admin/MissionManagePage';
import RewardManagePage from '../pages/admin/RewardManagePage';
import AppLayout from '../components/AppLayout';
import { useAuthStore } from '../store/authStore';

function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <StampHomePage /> },
      { path: '/missions', element: <MissionListPage /> },
      { path: '/missions/:missionId', element: <MissionDetailPage /> },
      { path: '/missions/my', element: <MyMissionsPage /> },
      { path: '/stamps', element: <StampsPage /> },
      { path: '/rewards', element: <RewardListPage /> },
      { path: '/rewards/redemptions', element: <MyRedemptionsPage /> },
      { path: '/mypage', element: <MyPage /> },
      {
        element: <AdminRoute />,
        children: [
          { path: '/admin/missions', element: <MissionManagePage /> },
          { path: '/admin/rewards', element: <RewardManagePage /> },
        ],
      },
    ],
  },
]);
