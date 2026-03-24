import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Alert, ConfigProvider, Spin, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { liveblocksConfigWarning, supabaseConfigError } from '@/lib/runtimeConfig';
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
  const { initializeAuth } = useAuthStore();

  // Initialize auth on app startup
  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Ensure 'dark' class is strictly removed for Warm Light mode
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  if (supabaseConfigError) {
    return (
      <div className="page-loader" style={{ padding: 24 }}>
        <div style={{ width: 'min(720px, 100%)' }}>
          <Alert
            type="error"
            showIcon
            message="Deployment Configuration Required"
            description={supabaseConfigError}
          />
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6B8068', /* Sage Green */
          colorPrimaryHover: '#556852',
          borderRadius: 32, /* Pebble-like shapes */
          fontFamily: '"Plus Jakarta Sans", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          colorBgContainer: 'rgba(255,255,255,0.85)',
          colorBgElevated: 'rgba(255,255,255,0.95)',
          colorBorder: 'rgba(139, 121, 94, 0.08)', /* Warm Sand */
          colorBorderSecondary: 'transparent',
          boxShadowSecondary: '0 12px 32px rgba(110, 100, 85, 0.04)',
          lineWidthFocus: 0,
          controlOutlineWidth: 0,
          colorTextBase: '#423e3a',
          colorTextSecondary: '#8c8781',
        },
        components: {
          Card: {
            colorBgContainer: 'rgba(255,255,255,0.85)',
            headerBg: 'transparent',
            boxShadow: '0 12px 32px rgba(110, 100, 85, 0.04), 0 4px 12px rgba(110, 100, 85, 0.02)',
            lineWidth: 0,
            borderRadiusLG: 32,
            paddingLG: 48, /* More breathing room */
          },
          Modal: {
            contentBg: 'rgba(255,255,255,0.95)',
            headerBg: 'transparent',
            boxShadow: '0 24px 64px rgba(110, 100, 85, 0.08)',
            lineWidth: 0,
            borderRadiusOuter: 36,
            borderRadiusLG: 36,
            paddingMD: 16,
            paddingContentHorizontalLG: 16,
          },
          Button: {
            borderRadius: 999, /* Pill */
            colorBorder: 'transparent',
            lineWidth: 0,
          },
          Input: {
            colorBgContainer: 'rgba(255,255,255,0.7)',
            colorBorder: 'rgba(139, 121, 94, 0.12)',
            hoverBorderColor: 'rgba(139, 121, 94, 0.2)',
            activeBorderColor: 'transparent',
            activeShadow: 'none',
            borderRadius: 999,
            lineWidth: 1,
          }
        }
      }}
    >
      <div className="aurora-bg" />
      {liveblocksConfigWarning && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 'min(720px, calc(100vw - 32px))' }}>
          <Alert type="warning" showIcon message="Live Collaboration Warning" description={liveblocksConfigWarning} />
        </div>
      )}
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/board/:boardId" element={<ProtectedRoute><CanvasBoard /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
