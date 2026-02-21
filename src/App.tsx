import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, Spin, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from '@/stores/authStore';
import './styles/global.css';

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/features/board/DashboardPage'));
const CanvasBoard = lazy(() => import('@/components/Canvas/CanvasBoard'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

// Loading component
const PageLoader: React.FC = () => (
  <div className="page-loader">
    <Spin size="large" />
  </div>
);

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    // Save the attempted URL to redirect back after login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

// Public route wrapper (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Force light mode
  const { initializeAuth } = useAuthStore();
  const isDark = false;

  // Initialize auth on app startup to restore Supabase session
  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Apply theme class to document
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#10B981',
          colorPrimaryHover: '#059669',
          borderRadius: 24, // softer overall radius
          fontFamily: '"Plus Jakarta Sans", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          colorBgContainer: 'transparent',
          colorBgElevated: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)',
          colorBorder: 'transparent', // Nuke global borders
          colorBorderSecondary: 'transparent',
          boxShadowSecondary: '0 24px 48px -12px rgba(0,0,0,0.06)', // The only shadow we need
          lineWidthFocus: 0,
          controlOutlineWidth: 0,
        },
        components: {
          Card: {
            colorBgContainer: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.4)',
            headerBg: 'transparent',
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.06)',
            lineWidth: 0, // Nuke card border
            borderRadiusLG: 24,
            paddingLG: 40, // Extreme whitespace
          },
          Modal: {
            contentBg: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)',
            headerBg: 'transparent',
            boxShadow: '0 32px 64px -16px rgba(0,0,0,0.1)',
            lineWidth: 0, // Nuke modal border
            borderRadiusOuter: 32,
            borderRadiusLG: 32,
            paddingMD: 40,
            paddingContentHorizontalLG: 40,
          },
          Button: {
            borderRadius: 999, // Extreme pill shape
            colorBorder: 'transparent',
            lineWidth: 0,
          },
          Input: {
            colorBgContainer: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.5)',
            colorBorder: 'transparent',
            hoverBorderColor: 'transparent',
            activeBorderColor: 'transparent',
            activeShadow: '0 4px 12px rgba(16, 185, 129, 0.1)', // Soft glow focus, no ring
            paddingBlock: 12,
            paddingInline: 20,
            borderRadius: 999, // Extreme pill shape
            lineWidth: 0,
          }
        }
      }}
    >
      <div className="aurora-bg" />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/board/:boardId"
              element={
                <ProtectedRoute>
                  <CanvasBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Redirect root to dashboard or login */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
