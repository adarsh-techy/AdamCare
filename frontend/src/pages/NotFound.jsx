import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Stethoscope, ArrowLeft, FileQuestion } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();
  const { accessToken } = useSelector((state) => state.auth);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_50%_0%,#ecfeff_0%,#f0f9ff_40%,#f8fafc_100%)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow blobs */}
      <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(13,105,93,0.07)_0%,rgba(0,0,0,0)_70%)] top-[-10%] left-[-10%] pointer-events-none" />
      <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(14,165,233,0.06)_0%,rgba(0,0,0,0)_70%)] bottom-[-10%] right-[-10%] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        {/* Logo */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(13,105,93,0.2)]">
          <Stethoscope size={24} color="white" />
        </div>

        {/* 404 number */}
        <div className="relative mb-4">
          <span className="text-[120px] font-heading font-bold leading-none bg-gradient-to-br from-primary via-primary-light to-secondary bg-clip-text text-transparent select-none">
            404
          </span>
          <FileQuestion
            size={36}
            className="absolute -top-2 -right-8 text-primary-light opacity-60"
            strokeWidth={1.5}
          />
        </div>

        <h1 className="text-xl font-heading font-semibold text-text-primary mb-2">
          Page Not Found
        </h1>
        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
          Double-check the URL or head back to a safe place.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 h-10 flex items-center justify-center gap-2 border border-slate-200 bg-white text-text-secondary text-sm font-semibold rounded-xl hover:bg-slate-50 hover:text-text-primary hover:border-slate-300 transition-all duration-150 cursor-pointer"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
          <button
            onClick={() => navigate(accessToken ? '/overview' : '/login', { replace: true })}
            className="flex-1 h-10 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold rounded-xl shadow-[0_4px_14px_rgba(13,105,93,0.2)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(13,105,93,0.25)] active:translate-y-0 transition-all duration-200 cursor-pointer"
          >
            {accessToken ? 'Go to Dashboard' : 'Go to Login'}
          </button>
        </div>

        {/* Brand footer */}
        <p className="mt-10 text-[11px] text-text-muted">
          Adam Care · Appointment Management System
        </p>
      </div>
    </div>
  );
};

export default NotFound;
