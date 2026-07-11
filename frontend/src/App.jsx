import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { initializeAuth, logoutSuccess, requirePasswordChange } from './store/slices/authSlice';
import ProtectedRoute from './components/common/ProtectedRoute';

// Lazy load page components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ChangeTempPassword = lazy(() => import('./pages/ChangeTempPassword'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Professional Loading Screen Fallback
const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
      <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
    </div>
    <div className="text-sm font-semibold text-slate-500 tracking-wide animate-pulse">Loading EMR Workspace...</div>
  </div>
);

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Restore user session on application load
    dispatch(initializeAuth());

    const handleAuthExpired = () => {
      dispatch(logoutSuccess());
    };

    const handlePasswordChangeRequired = () => {
      dispatch(requirePasswordChange());
    };

    window.addEventListener('auth_session_expired', handleAuthExpired);
    window.addEventListener('password_change_required', handlePasswordChangeRequired);
    return () => {
      window.removeEventListener('auth_session_expired', handleAuthExpired);
      window.removeEventListener('password_change_required', handlePasswordChangeRequired);
    };
  }, [dispatch]);

  return (
    <Router>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Root just points at the default section — not a distinct page */}
          <Route path="/" element={<Navigate to="/overview" replace />} />

          {/* Forced temporary-password change (still requires a valid session) */}
          <Route
            path="/change-temp-password"
            element={
              <ProtectedRoute>
                <ChangeTempPassword />
              </ProtectedRoute>
            }
          />

          {/* Every section (overview, doctors, departments, ...) is its own
              top-level route, not nested under a "/dashboard" parent — they
              all render the same Dashboard shell, which reads :tab from the
              URL to know which section to show. React Router ranks the static
              "/change-temp-password" route above this dynamic one regardless
              of declaration order, so there's no collision. */}
          <Route
            path="/:tab"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* 404 — catch all unmatched routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
