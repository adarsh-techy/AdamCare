import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Trash2, Lock, LockOpen, Pencil, Eye, EyeOff, Copy, Check } from 'lucide-react';
import api from '../../../services/apiClient';

const PAGE_SIZE = 10;

const SuperAdminStaffView = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('receptionist');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalStaff, setTotalStaff] = useState(0);
  const listContainerRef = useRef(null);
  const fetchingRef = useRef(false);

  // Modal toggle states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [deletingStaffId, setDeletingStaffId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [blockingStaffId, setBlockingStaffId] = useState(null);
  const [blockingCurrentStatus, setBlockingCurrentStatus] = useState('');

  // Edit staff modal states
  const [editingStaff, setEditingStaff] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOldPassword, setEditOldPassword] = useState('');
  const [showEditOldPassword, setShowEditOldPassword] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState('');

  // View password modal states
  const [viewingStaff, setViewingStaff] = useState(null);
  const [viewStep, setViewStep] = useState(1); // 1 = enter admin password, 2 = show result
  const [adminVerifyPassword, setAdminVerifyPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyErr, setVerifyErr] = useState('');
  const [copied, setCopied] = useState(false);

  // Lazy-loads staff 10 at a time instead of fetching everyone upfront.
  // pageNum=1 replaces the list (fresh load); pageNum>1 appends.
  const fetchStaffPage = useCallback(async (pageNum) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (pageNum === 1) setListLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.get('/auth/staff', { params: { excludeRole: 'doctor', page: pageNum, limit: PAGE_SIZE } });
      setStaffList((prev) => (pageNum === 1 ? res.data.data : [...prev, ...res.data.data]));
      setTotalStaff(res.data.meta?.total ?? res.data.data.length);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load staff list:', e.message);
    } finally {
      setListLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

  const fetchStaff = useCallback(() => fetchStaffPage(1), [fetchStaffPage]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const hasMoreStaff = staffList.length < totalStaff;

  // On-scroll pagination inside the registry's own scrollable container
  // (it has a fixed max-height, not the window) — load the next 10 once
  // the user nears the bottom of that container.
  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (fetchingRef.current || !hasMoreStaff) return;
      const scrolledToBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 150;
      if (scrolledToBottom) {
        fetchStaffPage(page + 1);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [fetchStaffPage, page, hasMoreStaff]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErr('');

    try {
      const payload = { name, email, password, role };
      await api.post('/auth/register', payload);
      
      // Reset input fields
      setName('');
      setEmail('');
      setPassword('');
      setRole('receptionist');
      
      // Close registration popup
      setShowRegisterModal(false);
      
      // Show success popup modal for 1s
      setMessage('Staff member created successfully.');
      setTimeout(() => {
        setMessage('');
      }, 1000);

      fetchStaff();
    } catch (error) {
      setErr(error.response?.data?.message || 'Failed to create staff');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaffClick = (id) => {
    setDeletingStaffId(id);
    setDeletePassword('');
    setShowDeletePassword(false);
    setDeleteErr('');
  };

  const handleConfirmDeleteStaff = async (e) => {
    e.preventDefault();
    if (!deletePassword) { setDeleteErr('Enter your password to confirm deletion.'); return; }
    setDeleteLoading(true); setDeleteErr('');
    try {
      await api.delete(`/auth/staff/${deletingStaffId}`, { data: { adminPassword: deletePassword } });
      setStaffList(prev => prev.filter(s => s._id !== deletingStaffId));
      setTotalStaff(prev => Math.max(prev - 1, 0));
      setDeletingStaffId(null);
    } catch (e) {
      setDeleteErr(e.response?.data?.message || 'Failed to delete staff member.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleBlock = (id, currentStatus) => {
    setBlockingStaffId(id);
    setBlockingCurrentStatus(currentStatus);
  };

  const handleOpenEdit = (staff) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditEmail(staff.email);
    setEditOldPassword('');
    setShowEditOldPassword(false);
    setEditNewPassword('');
    setShowEditPassword(false);
    setEditErr('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editName || !editEmail) { setEditErr('Name and email are required.'); return; }
    if (editNewPassword && !editOldPassword) { setEditErr('Current password is required to set a new password.'); return; }
    setEditLoading(true); setEditErr('');
    try {
      const payload = { name: editName, email: editEmail };
      if (editNewPassword) {
        payload.password = editNewPassword;
        payload.currentPassword = editOldPassword;
      }
      await api.put(`/auth/staff/${editingStaff._id}`, payload);
      setStaffList(prev => prev.map(s =>
        s._id === editingStaff._id ? { ...s, name: editName, email: editEmail } : s
      ));
      setEditingStaff(null);
    } catch (e) {
      setEditErr(e.response?.data?.message || 'Failed to update staff member.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenViewPassword = (staff) => {
    setViewingStaff(staff);
    setViewStep(1);
    setAdminVerifyPassword('');
    setShowAdminPassword(false);
    setRevealedPassword('');
    setVerifyErr('');
    setCopied(false);
  };

  const handleVerifyAndReveal = async (e) => {
    e.preventDefault();
    if (!adminVerifyPassword) { setVerifyErr('Please enter your password.'); return; }
    setVerifyLoading(true); setVerifyErr('');
    try {
      const res = await api.post(`/auth/staff/${viewingStaff._id}/reveal-password`, { adminPassword: adminVerifyPassword });
      setRevealedPassword(res.data.data.password);
      setViewStep(3);
    } catch (e) {
      setVerifyErr(e.response?.data?.message || 'Verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(revealedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmToggleBlock = async () => {
    const nextStatus = blockingCurrentStatus === 'blocked' ? 'active' : 'blocked';
    const targetId = blockingStaffId;
    setStaffList(prev => prev.map(s => s._id === targetId ? { ...s, status: nextStatus } : s));
    setBlockingStaffId(null);
    try {
      await api.put(`/auth/staff/${targetId}`, { status: nextStatus });
    } catch (e) {
      // Rollback on failure
      setStaffList(prev => prev.map(s => s._id === targetId ? { ...s, status: blockingCurrentStatus } : s));
      alert(e.response?.data?.message || 'Failed to update staff status');
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      {/* Title Header with Add Staff trigger button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Manage Adam Care Administrative Staff</h2>
          <p className="text-text-secondary text-sm">Register receptionists and super administrators, and review the current staff registry.</p>
        </div>
        <button
          onClick={() => {
            setShowRegisterModal(true);
            setErr('');
          }}
          className="px-5 h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer text-sm shrink-0"
        >
          + Add Staff
        </button>
      </div>

      {/* Main EMR Staff List Grid (Full Width) */}
      <div className="w-full">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-heading font-semibold mb-6 text-text-primary">Adam Care Active Administrative Registry</h3>
          
          <div ref={listContainerRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto pr-1">
            {listLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200/80 rounded-2xl overflow-hidden animate-pulse">
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 shrink-0" />
                    <div className="flex-grow flex flex-col gap-2 pt-1">
                      <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                      <div className="flex gap-1.5 mt-2">
                        <div className="h-4 bg-slate-100 rounded w-16" />
                        <div className="h-4 bg-slate-100 rounded w-12" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 h-12" />
                </div>
              ))
            ) : staffList.map((doc) => (
              <div key={doc._id} className={`border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
                doc.status === 'blocked'
                  ? 'bg-rose-50/50 border-rose-200/60 hover:border-rose-300'
                  : 'bg-white border-slate-200/80 hover:border-slate-300'
              }`}>
                {/* Member Info Body */}
                <div className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-slate-100 flex items-center justify-center shrink-0">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="overflow-hidden flex-grow">
                    <h4 className="font-semibold text-sm text-text-primary truncate">{doc.name}</h4>
                    <p className="text-xs text-text-secondary truncate mt-0.5">{doc.email}</p>

                    <div className="flex items-center gap-1.5 mt-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        doc.role === 'super_admin' 
                          ? 'bg-red-50 text-red-700 border border-red-200/30' 
                          : 'bg-blue-50 text-blue-700 border border-blue-200/30'
                      }`}>
                        {doc.role.replace('_', ' ')}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        doc.status === 'blocked' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/30' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/30'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          doc.status === 'blocked' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}></span>
                        {doc.status || 'active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action strip */}
                <div className="bg-slate-50/50 border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(doc)}
                    disabled={doc.mustChangePassword === false}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-primary/10 border border-slate-200 hover:border-primary/20 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-400"
                    title={doc.mustChangePassword === false ? 'Locked — user owns their profile now' : 'Edit Staff'}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleOpenViewPassword(doc)}
                    disabled={doc.mustChangePassword === false}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-secondary/10 border border-slate-200 hover:border-secondary/20 text-slate-400 hover:text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-400"
                    title={doc.mustChangePassword === false ? 'Password is private — no longer viewable' : 'View Password'}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleBlock(doc._id, doc.status)}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm ${
                      doc.status === 'blocked'
                        ? 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-emerald-200 text-slate-400 hover:text-emerald-600'
                        : 'bg-white hover:bg-amber-50 border-slate-200 hover:border-amber-200 text-slate-400 hover:text-amber-600'
                    }`}
                    title={doc.status === 'blocked' ? 'Unblock Account' : 'Block Access'}
                  >
                    {doc.status === 'blocked' ? <LockOpen size={14} /> : <Lock size={14} />}
                  </button>
                  <button
                    onClick={() => handleDeleteStaffClick(doc._id)}
                    className="w-8 h-8 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-danger flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm"
                    title="Delete Staff"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!listLoading && staffList.length === 0 && <p className="text-text-muted text-center text-sm py-12 col-span-full">No staff configured yet.</p>}

            {loadingMore && (
              <div className="col-span-full flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div>
              </div>
            )}

            {!listLoading && staffList.length > 0 && (
              <p className="col-span-full text-center text-[11px] font-semibold text-slate-400 pt-1">
                {hasMoreStaff
                  ? `Showing ${staffList.length} of ${totalStaff} — scroll for more`
                  : `Showing all ${totalStaff} staff member${totalStaff !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Add Staff Popup Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[9999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[450px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button 
              className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" 
              onClick={() => setShowRegisterModal(false)}
            >
              ×
            </button>
            
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Add Administrative Staff</h3>
            <p className="text-xs text-text-secondary mb-6">Register a new clinic receptionist or super administrator.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {err && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{err}</div>}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Role</label>
                <select 
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="receptionist">Receptionist</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  placeholder="john@emr.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Temporary Password</label>
                <p className="text-[10px] text-slate-400 -mt-1">This staff member will be required to set their own password on first login.</p>
                <input
                  type="password"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <button 
                type="submit" 
                className="w-full h-12 mt-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm" 
                disabled={loading}
              >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Register Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal Popup */}
      {message && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Registration Complete</h3>
            <p className="text-xs text-slate-500">{message}</p>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal — requires admin password */}
      {deletingStaffId && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[420px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setDeletingStaffId(null)}>×</button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-heading font-semibold text-text-primary">Delete Staff Member</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary mb-5 bg-rose-50 border border-rose-200/60 rounded-xl px-4 py-3">
              Enter <span className="font-bold text-rose-800">your super admin password</span> to confirm deletion of this staff record.
            </p>

            <form onSubmit={handleConfirmDeleteStaff} className="flex flex-col gap-4">
              {deleteErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center">{deleteErr}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Your Password</label>
                <div className="relative">
                  <input
                    type={showDeletePassword ? 'text' : 'password'}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-rose-400 focus:ring-3 focus:ring-rose-500/10 transition-all duration-150 text-sm"
                    placeholder="Enter your admin password..."
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowDeletePassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                    {showDeletePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setDeletingStaffId(null)} className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={deleteLoading} className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                  {deleteLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <><Trash2 size={13} /> Confirm Delete</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[440px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setEditingStaff(null)}>×</button>

            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Edit Staff Member</h3>
            <p className="text-xs text-text-secondary mb-5">Update name, email, or set a new password.</p>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {editErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{editErr}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>

              {editingStaff?.mustChangePassword === false ? (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-3 text-xs text-text-secondary">
                  This staff member has set their own password. It's private and can only be changed by them — an admin can no longer view or reset it.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">New Password <span className="normal-case font-normal text-slate-400">(leave blank to keep current)</span></label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                        placeholder="Enter new password..."
                        value={editNewPassword}
                        onChange={(e) => setEditNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowEditPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                        {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {editNewPassword && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Current Password <span className="normal-case font-normal text-slate-400">(required to confirm change)</span></label>
                      <div className="relative">
                        <input
                          type={showEditOldPassword ? 'text' : 'password'}
                          className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                          placeholder="Enter current password..."
                          value={editOldPassword}
                          onChange={(e) => setEditOldPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowEditOldPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                          {showEditOldPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setEditingStaff(null)} className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-primary hover:bg-primary/90 shadow-md transition cursor-pointer flex items-center justify-center">
                  {editLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Password Modal */}
      {viewingStaff && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[420px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setViewingStaff(null)}>×</button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <Eye size={18} className="text-secondary" />
              </div>
              <div>
                <h3 className="text-base font-heading font-semibold text-text-primary">View Credentials</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">For: <span className="font-semibold text-slate-700">{viewingStaff.name}</span></p>
              </div>
            </div>

            {/* Email — always visible */}
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Email</span>
              <span className="text-xs text-slate-700 font-medium">{viewingStaff.email}</span>
            </div>

            {/* Password section */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Password</span>

              {viewStep === 1 && viewingStaff.mustChangePassword === false && (
                <p className="text-xs text-text-secondary bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2.5">
                  This user has set their own password. It's private and can no longer be viewed by an admin.
                </p>
              )}

              {viewStep === 1 && viewingStaff.mustChangePassword !== false && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 tracking-widest flex-grow">••••••••</span>
                  <button
                    type="button"
                    onClick={() => setViewStep(2)}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-secondary/30 hover:bg-secondary/5 text-slate-400 hover:text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
                    title="View Password"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              )}

              {viewStep === 2 && (
                <form onSubmit={handleVerifyAndReveal} className="flex flex-col gap-3">
                  {verifyErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center">{verifyErr}</div>}
                  <p className="text-xs text-text-secondary bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2.5">
                    Enter <span className="font-bold text-amber-800">your super admin password</span> to reveal this credential.
                  </p>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                      placeholder="Enter your admin password..."
                      value={adminVerifyPassword}
                      onChange={(e) => setAdminVerifyPassword(e.target.value)}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowAdminPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                      {showAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button type="submit" disabled={verifyLoading} className="w-full h-10 text-xs font-semibold text-white rounded-xl bg-secondary hover:bg-secondary/90 shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                    {verifyLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <><Eye size={14} /> Reveal Password</>}
                  </button>
                </form>
              )}

              {viewStep === 3 && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-semibold text-slate-800 tracking-wider select-all flex-grow">
                      {revealedPassword || '(no password stored)'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-primary/30 hover:bg-primary/5 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">Sensitive credential — do not share in unsecured channels.</p>
                </>
              )}
            </div>

            <button type="button" onClick={() => setViewingStaff(null)} className="w-full h-11 mt-5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-md transition cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toggle Block Confirmation Modal Popup */}
      {blockingStaffId && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[400px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">
              {blockingCurrentStatus === 'blocked' ? 'Unblock Staff Access' : 'Block Staff Access'}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              {blockingCurrentStatus === 'blocked' 
                ? "Are you sure you want to unblock this staff member's account access?"
                : "Are you sure you want to block this staff member's account access?"}
            </p>

            <div className="flex gap-3 w-full">
              <button 
                type="button" 
                onClick={() => setBlockingStaffId(null)}
                className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmToggleBlock}
                className={`flex-grow h-11 text-xs font-semibold text-white rounded-xl shadow-md transition cursor-pointer ${
                  blockingCurrentStatus === 'blocked'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {blockingCurrentStatus === 'blocked' ? 'Confirm Unblock' : 'Confirm Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminStaffView;
