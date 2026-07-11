// Second step of the forgot password flow, reached from the emailed link
import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import api from '../services/apiClient';

const ResetPassword = () => {
  // Get the reset token from the URL
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!newPassword || !confirmPassword) {
      setErr('Please fill in both fields.');
      return;
    }
    if (newPassword.length < 6) {
      setErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword });
      // Send the user to login and show a success message there
      navigate('/login', { state: { passwordChanged: true }, replace: true });
    } catch (e) {
      // Show the backend's error message, like an expired or invalid link
      setErr(e.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-5 bg-white">
      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(2,132,199,0.2)]">
            <ShieldCheck size={24} color="white" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-text-primary mb-0.5">Set a New Password</h2>
          <p className="text-xs text-text-secondary">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" autoComplete="off">
          {err && (
            <div className="bg-danger-bg text-danger border border-danger/20 p-2.5 rounded-lg text-xs text-center">
              {err}
              {/* Only show this link when the error is about a bad token */}
              {/(invalid|expired)/i.test(err) && (
                <>
                  {' '}
                  <Link to="/forgot-password" className="underline font-semibold">Request a new link</Link>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">New Password</label>
            <input
              type="password"
              className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Confirm New Password</label>
            <input
              type="password"
              className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm"
            disabled={loading}
          >
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Reset Password'}
          </button>

          <Link to="/login" className="text-center text-xs font-semibold text-text-secondary hover:text-text-primary">
            Back to Login
          </Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
