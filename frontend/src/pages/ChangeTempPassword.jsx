import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import api from '../services/apiClient';
import { logoutUser } from '../store/slices/authSlice';

const ChangeTempPassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Navigating to /login directly (without clearing the session) would just
  // bounce straight back here, since the account is still flagged
  // mustChangePassword=true — so "Back" has to log out first, same as the
  // successful-change path does. Using the shared logoutUser thunk (rather
  // than clearing localStorage by hand) guarantees the axios instance's
  // cached auth token gets cleared too, not just redux/localStorage.
  const handleBack = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setFormError('New password must be different from the temporary password.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-temp-password', { currentPassword, newPassword });

      // Backend already invalidated the session's refresh tokens server-side —
      // clear the local session (and the axios instance's cached token) too,
      // and send the user back to log in with the new password.
      await dispatch(logoutUser());
      navigate('/login', { state: { passwordChanged: true }, replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to change password.');
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
          <p className="text-xs text-text-secondary">You're signed in with a temporary password. Set your own before continuing.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" autoComplete="off">
          {formError && (
            <div className="bg-danger-bg text-danger border border-danger/20 p-2.5 rounded-lg text-xs text-center">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Temporary Password</label>
            <input
              type="password"
              className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              placeholder="The password you just logged in with"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>

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
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Set New Password & Log In Again'}
          </button>

          <button
            type="button"
            onClick={handleBack}
            disabled={loading}
            className="w-full h-10 bg-white border border-slate-200 hover:bg-slate-50 text-text-secondary hover:text-text-primary font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 text-xs"
          >
            <ArrowLeft size={14} />
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangeTempPassword;
