import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children }) => {
  const { accessToken, user } = useSelector((state) => state.auth);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/change-temp-password') {
    return <Navigate to="/change-temp-password" replace />;
  }

  return children;
};

export default ProtectedRoute;
