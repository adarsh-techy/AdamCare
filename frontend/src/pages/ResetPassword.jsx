// Step 2 of the "Forgot Password" flow — reached only via the link emailed
// by ForgotPassword.jsx (step 1). The token in the URL is single-use and
// expires 30 minutes after being requested (enforced server-side in
// auth.controller.js's resetPassword); this page has no way to know that
// in advance, so an invalid/expired token just surfaces as a submit error.
import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import api from '../services/apiClient';

const ResetPassword = () => {
  // :token comes straight from the URL — see the /reset-password/:token
  // route in App.jsx. We just forward it to the backend as-is; all the
  // actual validation (hash match + expiry) happens server-side.
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
      // Mirrors ChangeTempPassword.jsx's post-success pattern: send the user
      // back to Login with a flag Login.jsx reads to show a success banner,
      // rather than trying to auto-log them in here.
      navigate('/login', { state: { passwordChanged: true }, replace: true });
    } catch (e) {
      // The backend's message here IS meant to be shown (unlike
      // forgot-password's silent-failure pattern) — "invalid or expired
      // token" doesn't leak anything about which emails are registered,
      // it's just telling the user their specific link didn't work.
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
              {/* Only worth offering "get a new link" when the token itself
                  is the problem (expired/already used/invalid) — a
                  validation error like "too short" doesn't need it, since
                  the same token is still usable once they fix the password. */}
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
