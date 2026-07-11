import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock } from 'lucide-react';
import api from '../../services/apiClient';

const POLL_INTERVAL_MS = 30000;

// Super-admin-only notification bell for pending qualification-change
// requests. Clicking an item deep-links to the right list (doctors vs
// staff) and hands the full user object across via navigation state, so
// the target page can open the review modal immediately without needing
// to find that user in its own (paginated) list first.
const NotificationBell = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await api.get('/auth/staff/pending-qualifications');
      setPending(res.data.data);
    } catch (e) {
      console.error('Failed to load pending qualification requests:', e.response?.data?.message || e.message);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPending]);

  // Live updates via the staff_change socket event (see Dashboard.jsx) — a
  // new request, approval, or rejection refreshes the badge immediately
  // instead of waiting for the next poll.
  useEffect(() => {
    const handleWS = () => fetchPending();
    window.addEventListener('staff_changed_ws', handleWS);
    return () => window.removeEventListener('staff_changed_ws', handleWS);
  }, [fetchPending]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (item) => {
    // Only doctors can have a qualification (and therefore a pending
    // change) — always routes to Manage Clinic Doctors.
    setOpen(false);
    navigate('/doctors', { state: { reviewQualUser: item } });
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        title="Pending approvals"
        className="w-9 h-9 rounded-lg bg-transparent hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all duration-150 relative border-none"
      >
        <Bell size={18} className="text-slate-500" />
        {pending.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
            {pending.length > 9 ? '9+' : pending.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] bg-white border border-slate-200/80 shadow-2xl rounded-2xl overflow-hidden z-[9999] animate-[fadeIn_0.15s_ease-out]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Pending Approvals</p>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {pending.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-8">Nothing needs your review.</p>
            ) : (
              pending.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors duration-100 cursor-pointer flex items-start gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={13} className="text-amber-600" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-text-primary truncate">{item.name}</p>
                    <p className="text-[10px] text-text-secondary uppercase tracking-wide">{item.role.replace('_', ' ')}</p>
                    <p className="text-[11px] text-amber-700 font-semibold mt-0.5 truncate">Requested: {item.pendingQualification}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
