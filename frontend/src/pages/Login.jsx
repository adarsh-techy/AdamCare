import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { loginUser } from '../store/slices/authSlice';
import { Stethoscope } from 'lucide-react';
import emrBg from '../assets/EMR.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error: loginError, accessToken, user } = useSelector((state) => state.auth);
  const successMsg = location.state?.passwordChanged
    ? 'Password changed successfully. Please log in with your new password.'
    : '';

  useEffect(() => {
    if (accessToken) {
      navigate(user?.mustChangePassword ? '/change-temp-password' : '/overview');
    }
  }, [accessToken, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email || !password) {
      setFormError('Please fill in all fields');
      return;
    }

    const result = await dispatch(loginUser({ email, password }));
    if (result.success) {
      navigate(result.user?.mustChangePassword ? '/change-temp-password' : '/overview');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative bg-slate-50 overflow-hidden">
      {/* Left side shows a banner image */}
      <div className="hidden md:block relative h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${emrBg})` }}>
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/20 via-transparent to-slate-900/10 backdrop-blur-[0.5px]"></div>
      </div>

      {/* Right side has the login form */}
      <div className="flex items-center justify-center relative p-5 md:p-10 bg-white">
        <div className="relative w-full max-w-[400px]">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(2,132,199,0.2)]">
              <Stethoscope size={24} color="white" />
            </div>
            <h2 className="text-2xl font-heading font-semibold text-text-primary mb-0.5">Adam Care</h2>
            <p className="text-xs text-text-secondary">Appointment Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" autoComplete="off">
            {!formError && !loginError && successMsg && (
              <div className="bg-success-bg text-success border border-success/20 p-2.5 rounded-lg text-xs text-center">
                {successMsg}
              </div>
            )}
            {(formError || loginError) && (
              <div className="bg-danger-bg text-danger border border-danger/20 p-2.5 rounded-lg text-xs text-center">
                {formError || loginError}
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

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Password</label>
                {/* Link to start the forgot password flow */}
                <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary-light">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm"
              disabled={loading}
            >
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
