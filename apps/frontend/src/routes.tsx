import { Box, CircularProgress } from '@mui/material';
import type { ReactElement } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import DashboardLayout from './layouts/dashboard/DashboardLayout';
import { useAppSelector } from './redux/hooks';

import LoginPage from './pages/LoginPage';
import UserPage from './pages/UserPage';
import DashboardPage from './pages/DashboardPage';
import SecurityPage from './pages/SecurityPage';
import NotificationPreferencesPage from './pages/NotificationPreferencesPage';
import OrganizationAdminPage from './pages/OrganizationAdminPage';

const AuthLoading = (): JSX.Element => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <CircularProgress size={28} />
  </Box>
);

const ProtectedLayout = (): JSX.Element => {
  const authStatus = useAppSelector((state) => state.auth.status);

  if (authStatus === 'checking') {
    return <AuthLoading />;
  }

  if (authStatus !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout />;
};

const Router = (): ReactElement | null =>
  useRoutes([
    { path: '/login', element: <LoginPage /> },
    {
      path: '/',
      element: <ProtectedLayout />,
      children: [
        { element: <Navigate to="/dashboard" />, index: true },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'user', element: <UserPage /> },
        { path: 'security', element: <SecurityPage /> },
        { path: 'notifications', element: <NotificationPreferencesPage /> },
        { path: 'admin', element: <OrganizationAdminPage /> },
      ],
    },
    { path: '*', element: <Navigate to="/dashboard" replace /> },
  ]);

export default Router;
