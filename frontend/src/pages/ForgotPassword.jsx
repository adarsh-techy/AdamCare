// First step of the forgot password flow, where the user enters their email
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api from '../services/apiClient';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  // True once the form has been submitted, to show the confirmation message
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    if (!email) {
      setErr('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch (e) {
      // Stay quiet on errors so we don't reveal which emails are registered
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-5 bg-white">
      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(2,132,199,0.2)]">
            <KeyRound size={24} color="white" />
          </div>
          <h2 className="text-2xl font-heading font-semibold text-text-primary mb-0.5">Forgot Password</h2>
          <p className="text-xs text-text-secondary">Enter your email and we'll send you a reset link.</p>
        </div>

        {submitted ? (
          <div className="flex flex-col gap-6">
            <div className="bg-success-bg text-success border border-success/20 p-3 rounded-lg text-xs text-center">
              If that email is registered, a password reset link has been sent. Check your inbox — the link expires in 30 minutes.
            </div>
            <Link
              to="/login"
              className="w-full h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer text-sm"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6" autoComplete="off">
            {err && (
              <div className="bg-danger-bg text-danger border border-danger/20 p-2.5 rounded-lg text-xs text-center">
                {err}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                placeholder="e.g. admin@emr.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm"
              disabled={loading}
            >
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Send Reset Link'}
            </button>

            <Link to="/login" className="text-center text-xs font-semibold text-text-secondary hover:text-text-primary">
              Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
