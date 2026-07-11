import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { initializeAuth, logoutSuccess, requirePasswordChange } from './store/slices/authSlice';
import ProtectedRoute from './components/common/ProtectedRoute';

// Load each page only when it's needed
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ChangeTempPassword = lazy(() => import('./pages/ChangeTempPassword'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Spinner shown while a page is loading
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
    // Check if the user is already logged in
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
          {/* Login page, open to everyone */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Home page just redirects to the overview section */}
          <Route path="/" element={<Navigate to="/overview" replace />} />

          {/* Page for changing a temporary password, must be logged in */}
          <Route
            path="/change-temp-password"
            element={
              <ProtectedRoute>
                <ChangeTempPassword />
              </ProtectedRoute>
            }
          />

          {/* All dashboard sections share this route, the URL tab decides what shows */}
          <Route
            path="/:tab"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Show a 404 page for any unknown URL */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
