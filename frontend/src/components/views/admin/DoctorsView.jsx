import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trash2, Pencil, Lock, Unlock, Eye, EyeOff, Copy, Check, Clock } from 'lucide-react';
import api from '../../../services/apiClient';

const PAGE_SIZE = 5;

// Dashboard's main content area (Dashboard.jsx's <main>) is what actually
// scrolls — the window/document never does in this fixed-shell layout — so
// walk up from a ref inside this view to find whichever ancestor really is
// scrollable, rather than assuming window.
const findScrollParent = (el) => {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY)) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};

const SuperAdminDoctorView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [doctorList, setDoctorList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalDoctors, setTotalDoctors] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');
  const [listErr, setListErr] = useState('');
  const rootRef = useRef(null);
  const fetchingRef = useRef(false);

  const [qualification, setQualification] = useState('');
  const [editQualification, setEditQualification] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [showEditNewPassword, setShowEditNewPassword] = useState(false);
  const [editCurrentPassword, setEditCurrentPassword] = useState('');
  const [showEditCurrentPassword, setShowEditCurrentPassword] = useState(false);

  // Modal toggle state
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Qualification change review modal state
  const [reviewingQualDoc, setReviewingQualDoc] = useState(null);
  const [reviewQualLoading, setReviewQualLoading] = useState(false);
  const [reviewQualErr, setReviewQualErr] = useState('');

  // Deep-link from the notification bell: it hands over the full user
  // object via navigation state (rather than just an ID) so this modal can
  // open immediately without needing that user to already be in this
  // view's own paginated list.
  useEffect(() => {
    if (location.state?.reviewQualUser) {
      setReviewingQualDoc(location.state.reviewQualUser);
      setReviewQualErr('');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Delete Doctor modal state
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleteDocPassword, setDeleteDocPassword] = useState('');
  const [showDeleteDocPassword, setShowDeleteDocPassword] = useState(false);
  const [deleteDocErr, setDeleteDocErr] = useState('');
  const [deleteDocLoading, setDeleteDocLoading] = useState(false);


  // Reveal Password modal state
  const [revealDoc, setRevealDoc] = useState(null);
  const [revealStep, setRevealStep] = useState(1);
  const [revealAdminPassword, setRevealAdminPassword] = useState('');
  const [showRevealAdminPassword, setShowRevealAdminPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealErr, setRevealErr] = useState('');
  const [revealCopied, setRevealCopied] = useState(false);

  // Edit Doctor Modal states
  const [editingDoc, setEditingDoc] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [editErr, setEditErr] = useState('');

  // Lazy-loads doctors 5 at a time instead of fetching the whole registry.
  // pageNum=1 replaces the list (fresh load / filter change); pageNum>1 appends.
  const fetchDoctorsPage = useCallback(async (pageNum, deptFilter) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (pageNum === 1) { setListLoading(true); setListErr(''); }
    else { setLoadingMore(true); }
    try {
      const params = { role: 'doctor', page: pageNum, limit: PAGE_SIZE };
      if (deptFilter && deptFilter !== 'all') params.department = deptFilter;
      const res = await api.get('/auth/staff', { params });
      setDoctorList(prev => (pageNum === 1 ? res.data.data : [...prev, ...res.data.data]));
      setTotalDoctors(res.data.meta?.total ?? res.data.data.length);
      setPage(pageNum);
    } catch (e) {
      console.error('Failed to load doctors list:', e.response?.data?.message || e.message);
      setListErr(e.response?.data?.message || 'Failed to load doctors list.');
    } finally {
      setListLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

  const fetchDoctors = useCallback(() => fetchDoctorsPage(1, selectedDeptFilter), [fetchDoctorsPage, selectedDeptFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.data);
      if (res.data.data.length > 0) {
        setDepartment(res.data.data[0].name);
      }
    } catch (e) {
      console.error('Failed to load departments:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Re-runs (resetting to page 1) whenever the department filter changes,
  // since fetchDoctors' identity changes with selectedDeptFilter.
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit (e.g. 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErr('File size is too large. Please select an image under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result); // Base64 Data URL string
    };
    reader.onerror = () => {
      setErr('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErr('');

    try {
      const payload = { 
        name, 
        email, 
        password, 
        role: 'doctor', 
        department,
        avatar,
        qualification
      };

      await api.post('/auth/register', payload);
      
      // Reset input fields
      setName('');
      setEmail('');
      setPassword('');
      setAvatar('');
      setQualification('');
      
      // Close registration popup
      setShowRegisterModal(false);
      
      // Show success popup modal for 1s
      setMessage('Doctor registered successfully.');
      setTimeout(() => {
        setMessage('');
      }, 1000);
      
      fetchDoctors();
    } catch (error) {
      setErr(error.response?.data?.message || 'Failed to register doctor');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoctorClick = useCallback((doc) => {
    setDeletingDoc(doc);
    setDeleteDocPassword('');
    setShowDeleteDocPassword(false);
    setDeleteDocErr('');
  }, []);

  const handleConfirmDeleteDoctor = useCallback(async (e) => {
    e.preventDefault();
    if (!deleteDocPassword) { setDeleteDocErr('Enter your password to confirm deletion.'); return; }
    setDeleteDocLoading(true); setDeleteDocErr('');
    try {
      await api.delete(`/auth/staff/${deletingDoc._id}`, { data: { adminPassword: deleteDocPassword } });
      setDoctorList(prev => prev.filter(d => d._id !== deletingDoc._id));
      setTotalDoctors(prev => Math.max(prev - 1, 0));
      setDeletingDoc(null);
    } catch (e) {
      setDeleteDocErr(e.response?.data?.message || 'Failed to delete doctor.');
    } finally {
      setDeleteDocLoading(false);
    }
  }, [deleteDocPassword, deletingDoc]);

  const handleToggleBlock = useCallback(async (doctor) => {
    const nextStatus = doctor.status === 'blocked' ? 'active' : 'blocked';
    setDoctorList(prev => prev.map(d => d._id === doctor._id ? { ...d, status: nextStatus } : d));
    try {
      await api.put(`/auth/staff/${doctor._id}`, { status: nextStatus });
    } catch (e) {
      // Rollback on failure
      setDoctorList(prev => prev.map(d => d._id === doctor._id ? { ...d, status: doctor.status } : d));
      alert(e.response?.data?.message || 'Failed to update doctor status');
    }
  }, []);

  const handleApproveQualification = useCallback(async (doctor) => {
    setReviewQualLoading(true);
    setReviewQualErr('');
    try {
      const res = await api.post(`/auth/staff/${doctor._id}/approve-qualification`);
      setDoctorList(prev => prev.map(d => d._id === doctor._id
        ? { ...d, qualification: res.data.data.qualification, pendingQualification: null }
        : d));
      setReviewingQualDoc(null);
    } catch (e) {
      setReviewQualErr(e.response?.data?.message || 'Failed to approve qualification change.');
    } finally {
      setReviewQualLoading(false);
    }
  }, []);

  const handleRejectQualification = useCallback(async (doctor) => {
    setReviewQualLoading(true);
    setReviewQualErr('');
    try {
      await api.post(`/auth/staff/${doctor._id}/reject-qualification`);
      setDoctorList(prev => prev.map(d => d._id === doctor._id ? { ...d, pendingQualification: null } : d));
      setReviewingQualDoc(null);
    } catch (e) {
      setReviewQualErr(e.response?.data?.message || 'Failed to reject qualification change.');
    } finally {
      setReviewQualLoading(false);
    }
  }, []);

  const handleOpenReveal = useCallback((doc) => {
    setRevealDoc(doc);
    setRevealStep(1);
    setRevealAdminPassword('');
    setShowRevealAdminPassword(false);
    setRevealedPassword('');
    setRevealErr('');
    setRevealCopied(false);
  }, []);

  const handleVerifyAndReveal = useCallback(async (e) => {
    e.preventDefault();
    if (!revealAdminPassword) { setRevealErr('Please enter your password.'); return; }
    setRevealLoading(true); setRevealErr('');
    try {
      const res = await api.post(`/auth/staff/${revealDoc._id}/reveal-password`, { adminPassword: revealAdminPassword });
      setRevealedPassword(res.data.data.password);
      setRevealStep(3);
    } catch (e) {
      setRevealErr(e.response?.data?.message || 'Verification failed.');
    } finally {
      setRevealLoading(false);
    }
  }, [revealAdminPassword, revealDoc]);

  const handleCopyRevealedPassword = useCallback(() => {
    navigator.clipboard.writeText(revealedPassword);
    setRevealCopied(true);
    setTimeout(() => setRevealCopied(false), 2000);
  }, [revealedPassword]);

  const handleOpenEdit = useCallback((doc) => {
    setEditingDoc(doc);
    setEditName(doc.name);
    setEditEmail(doc.email);
    setEditDepartment(doc.department || '');
    setEditAvatar(doc.avatar || '');
    setEditQualification(doc.qualification || '');
    setEditNewPassword('');
    setShowEditNewPassword(false);
    setEditCurrentPassword('');
    setShowEditCurrentPassword(false);
    setEditErr('');
  }, []);

  const handleSaveEdit = useCallback(async (e) => {
    e.preventDefault();
    if (!editName || !editEmail || !editDepartment) {
      setEditErr('Please fill in all fields');
      return;
    }
    if (editCurrentPassword && !editNewPassword) {
      setEditErr('Please enter a new password.');
      return;
    }
    if (editNewPassword && !editCurrentPassword) {
      setEditErr('Current password is required to set a new password.');
      return;
    }
    setLoading(true);
    setEditErr('');
    try {
      const payload = {
        name: editName,
        email: editEmail,
        department: editDepartment,
        avatar: editAvatar,
        qualification: editQualification
      };
      if (editNewPassword) {
        payload.password = editNewPassword;
        payload.currentPassword = editCurrentPassword;
      }
      await api.put(`/auth/staff/${editingDoc._id}`, payload);
      setDoctorList(prev => prev.map(d =>
        d._id === editingDoc._id
          ? { ...d, name: editName, email: editEmail, department: editDepartment, avatar: editAvatar, qualification: editQualification }
          : d
      ));
      setEditingDoc(null);
    } catch (error) {
      setEditErr(error.response?.data?.message || 'Failed to update doctor');
    } finally {
      setLoading(false);
    }
  }, [editName, editEmail, editDepartment, editAvatar, editQualification, editCurrentPassword, editNewPassword, editingDoc]);

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setEditErr('File size is too large. Image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Department filtering now happens server-side (see fetchDoctorsPage), so
  // doctorList already only contains matching doctors — just group for display.
  const groupedDoctors = useMemo(() => {
    const groups = doctorList.reduce((acc, doc) => {
      const dept = doc.department || 'General';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(doc);
      return acc;
    }, {});
    return Object.entries(groups);
  }, [doctorList]);

  const hasMoreDoctors = doctorList.length < totalDoctors;

  // On-scroll pagination: load the next 5 once the user nears the bottom of
  // the actual scrolling container (Dashboard's <main>), instead of a
  // manual "Load More" click.
  useEffect(() => {
    const scrollEl = findScrollParent(rootRef.current);
    const isWindowScroll = scrollEl === document.scrollingElement || scrollEl === document.documentElement;

    const handleScroll = () => {
      if (fetchingRef.current || !hasMoreDoctors) return;
      const scrolledToBottom = isWindowScroll
        ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200
        : scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 200;
      if (scrolledToBottom) {
        fetchDoctorsPage(page + 1, selectedDeptFilter);
      }
    };

    const target = isWindowScroll ? window : scrollEl;
    target.addEventListener('scroll', handleScroll);
    return () => target.removeEventListener('scroll', handleScroll);
  }, [fetchDoctorsPage, page, hasMoreDoctors, selectedDeptFilter]);

  return (
    <div ref={rootRef} className="w-full animate-[fadeIn_0.2s_ease-out]">
      {/* Title Header with Add Doctor trigger button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Manage Clinic Doctors</h2>
          <p className="text-text-secondary text-sm">Register doctors, configure department specialities, and review the medical staff registry.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Department Filter Dropdown */}
          <select
            value={selectedDeptFilter}
            onChange={(e) => setSelectedDeptFilter(e.target.value)}
            className="h-11 px-4 bg-white border border-slate-200 rounded-xl outline-none text-xs text-text-primary font-semibold shadow-sm focus:border-primary-light focus:ring-2 focus:ring-primary/10 cursor-pointer min-w-[170px]"
          >
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept.name}>{dept.name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setShowRegisterModal(true);
              setErr('');
            }}
            className="px-5 h-11 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer text-sm shrink-0"
          >
            + Add Doctor
          </button>
        </div>
      </div>

      {/* Doctors Registry — Department-wise Sections */}
      {listErr && (
        <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm mb-4 text-center">{listErr}</div>
      )}
      <div className="w-full flex flex-col gap-5">
        {listLoading ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden animate-pulse">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 h-12" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 border-b border-slate-100 last:border-0">
                <div className="w-9 h-9 rounded-lg bg-slate-100 shrink-0" />
                <div className="flex flex-col gap-1.5 flex-grow">
                  <div className="h-3.5 bg-slate-100 rounded w-36" />
                  <div className="h-3 bg-slate-100 rounded w-24" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-44 ml-auto" />
                <div className="flex gap-2 ml-4">
                  <div className="w-7 h-7 bg-slate-100 rounded-lg" />
                  <div className="w-7 h-7 bg-slate-100 rounded-lg" />
                  <div className="w-7 h-7 bg-slate-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : doctorList.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm px-6 py-14 text-center">
            <p className="text-text-muted text-sm">
              {selectedDeptFilter === 'all' ? 'No doctors configured yet.' : 'No doctors found matching this department.'}
            </p>
          </div>
        ) : (
          groupedDoctors.map(([dept, docs]) => (
            <div key={dept} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              {/* Department Header */}
              <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-pink-700 bg-pink-100 border border-pink-200 px-3 py-1 rounded-full">
                  {dept}
                </span>
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-[10px] font-semibold text-slate-400">
                  {docs.length} doctor{docs.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Table */}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-white">
                    <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-2.5 border-b border-slate-100 w-[50%]">Doctor</th>
                    <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-2.5 border-b border-slate-100 w-[35%]">Qualification</th>
                    <th className="text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-2.5 border-b border-slate-100 w-[15%]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc, idx) => (
                    <tr
                      key={doc._id}
                      className={`group transition-colors duration-100 hover:bg-slate-50/60 ${idx !== docs.length - 1 ? 'border-b border-slate-100' : ''} ${doc.status === 'blocked' ? 'bg-rose-50/30' : ''}`}
                    >
                      {/* Physician */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0 flex items-center justify-center bg-white ${doc.status === 'blocked' ? 'filter grayscale opacity-60' : ''}`}>
                            {doc.avatar ? (
                              <img src={doc.avatar} alt={doc.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                <span className="text-white text-sm font-bold">{doc.name?.charAt(0) || 'D'}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-semibold text-sm ${doc.status === 'blocked' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{doc.name}</span>
                            {doc.qualification && (
                              <span className="text-[10px] text-primary font-bold mt-0.5">{doc.qualification}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Qualification */}
                      <td className="px-4 py-3.5">
                        {doc.qualification ? (
                          <span className="text-xs font-semibold text-primary">{doc.qualification}</span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">—</span>
                        )}
                        {doc.pendingQualification && (
                          <button
                            type="button"
                            onClick={() => { setReviewingQualDoc(doc); setReviewQualErr(''); }}
                            className="mt-1.5 flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-150"
                          >
                            <Clock size={10} /> Pending Request
                          </button>
                        )}
                      </td>


                      {/* Action */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View — disabled once the doctor has set their own password (no longer viewable) */}
                          <button
                            onClick={() => handleOpenReveal(doc)}
                            disabled={doc.mustChangePassword === false}
                            className="w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title={doc.mustChangePassword === false ? 'Password is private — no longer viewable' : 'View Doctor'}
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit — disabled once the doctor has set their own password (profile is locked from admin changes) */}
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            disabled={doc.mustChangePassword === false}
                            className="w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title={doc.mustChangePassword === false ? 'Locked — user owns their profile now' : 'Edit Doctor'}
                          >
                            <Pencil size={13} />
                          </button>
                          
                          {/* Block / Unblock */}
                          <button
                            onClick={() => handleToggleBlock(doc)}
                            className={`w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all duration-150 ${
                              doc.status === 'blocked'
                                ? 'text-slate-400 hover:text-emerald-600'
                                : 'text-slate-400 hover:text-amber-600'
                            }`}
                            title={doc.status === 'blocked' ? 'Unblock' : 'Block'}
                          >
                            {doc.status === 'blocked' ? <Unlock size={13} /> : <Lock size={13} />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteDoctorClick(doc)}
                            className="w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-danger flex items-center justify-center cursor-pointer transition-all duration-150"
                            title="Delete Doctor"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>

      {/* On-scroll pagination — fetches 5 more doctors automatically as you
          scroll near the bottom, instead of loading everything upfront */}
      {!listLoading && doctorList.length > 0 && (
        <div className="flex flex-col items-center gap-2 mt-6">
          {loadingMore && (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div>
          )}
          <span className="text-[11px] font-semibold text-slate-400">
            {hasMoreDoctors
              ? `Showing ${doctorList.length} of ${totalDoctors} — scroll for more`
              : `Showing all ${totalDoctors} doctor${totalDoctors !== 1 ? 's' : ''}`}
          </span>
        </div>
      )}

      {/* Add Doctor Popup Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[9999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[450px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button 
              className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" 
              onClick={() => setShowRegisterModal(false)}
            >
              ×
            </button>
            
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Add New Physician</h3>
            <p className="text-xs text-text-secondary mb-6">Register doctor details, assign department and profile photo.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {err && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{err}</div>}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  placeholder="Dr. Tommy Alex"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  required 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Qualification <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. MBBS, MD, FRCS"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department</label>
                {departments.length === 0 ? (
                  <p className="text-xs text-danger font-semibold">Please create a department first under "Manage Departments" page.</p>
                ) : (
                  <select 
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                    value={department} 
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Doctor Profile Image</label>
                <input 
                  id="doctor-avatar-file"
                  type="file" 
                  accept="image/*"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" 
                  onChange={handleFileChange} 
                />
                {avatar && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                      <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs text-text-secondary font-semibold">Image loaded</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  placeholder="doctor@emr.com"
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  required 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Temporary Password</label>
                <p className="text-[10px] text-slate-400 -mt-1">The doctor will be required to set their own password on first login.</p>
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
                disabled={loading || departments.length === 0}
              >
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Register Doctor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Popup Form Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[9999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[440px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-heading font-semibold text-text-primary">Edit Doctor Profile</h3>
              <button 
                onClick={() => setEditingDoc(null)} 
                className="text-text-muted hover:text-text-primary text-lg cursor-pointer bg-transparent border-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col">
              {editErr && (
                <div className="bg-danger-bg text-danger border border-danger/20 p-3 rounded-lg text-xs mb-4 text-center">
                  {editErr}
                </div>
              )}

              {/* Profile Image Pick */}
              <div className="mb-4 flex flex-col items-center gap-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-secondary w-full text-left">Profile Image</label>
                <div className="flex items-center gap-4 w-full bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200/80 shadow-sm shrink-0 flex items-center justify-center bg-white">
                    {editAvatar ? (
                      <img src={editAvatar} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-text-muted text-xs font-bold">No Image</span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleEditFileChange}
                      className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  placeholder="e.g. Dr. Arthur Pendragon" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  placeholder="doctor@emr.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="off"
                />
              </div>

              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department Specialty</label>
                <select
                  className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm cursor-pointer"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  disabled={loading}
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {editingDoc?.mustChangePassword === false ? (
                <div className="mb-4 bg-slate-50 border border-slate-200/60 rounded-xl px-3.5 py-3 text-xs text-text-secondary">
                  This doctor has set their own password. It's private and can only be changed by them — an admin can no longer view or reset it.
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Current Password <span className="normal-case font-normal text-slate-400">(leave blank to skip password change)</span></label>
                    <div className="relative">
                      <input
                        type={showEditCurrentPassword ? 'text' : 'password'}
                        className="bg-white border border-slate-200 rounded-lg p-2.5 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm w-full"
                        placeholder="Enter current password..."
                        value={editCurrentPassword}
                        onChange={(e) => setEditCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                      />
                      <button type="button" onClick={() => setShowEditCurrentPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                        {showEditCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {editCurrentPassword && (
                    <div className="mb-4 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">New Password</label>
                      <div className="relative">
                        <input
                          type={showEditNewPassword ? 'text' : 'password'}
                          className="bg-white border border-slate-200 rounded-lg p-2.5 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm w-full"
                          placeholder="Enter new password..."
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={loading}
                        />
                        <button type="button" onClick={() => setShowEditNewPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                          {showEditNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 mt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingDoc(null)}
                  className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-primary to-secondary shadow-md transition cursor-pointer flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-primary-light"></div> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* View Credentials Modal */}
      {revealDoc && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative w-full max-w-[420px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setRevealDoc(null)}>×</button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <Eye size={18} className="text-secondary" />
              </div>
              <div>
                <h3 className="text-base font-heading font-semibold text-text-primary">View Credentials</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">For: <span className="font-semibold text-slate-700">{revealDoc.name}</span></p>
              </div>
            </div>

            {/* Email — always visible */}
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 mb-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Email</span>
              <span className="text-xs text-slate-700 font-medium">{revealDoc.email}</span>
            </div>

            {/* Password section */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Password</span>

              {revealStep === 1 && revealDoc.mustChangePassword === false && (
                <p className="text-xs text-text-secondary bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2.5">
                  This user has set their own password. It's private and can no longer be viewed by an admin.
                </p>
              )}

              {revealStep === 1 && revealDoc.mustChangePassword !== false && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 tracking-widest flex-grow">••••••••</span>
                  <button
                    type="button"
                    onClick={() => setRevealStep(2)}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:border-secondary/30 hover:bg-secondary/5 text-slate-400 hover:text-secondary flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
                    title="View Password"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              )}

              {revealStep === 2 && (
                <form onSubmit={handleVerifyAndReveal} className="flex flex-col gap-3">
                  {revealErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center">{revealErr}</div>}
                  <p className="text-xs text-text-secondary bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2.5">
                    Enter <span className="font-bold text-amber-800">your super admin password</span> to reveal this credential.
                  </p>
                  <div className="relative">
                    <input
                      type={showRevealAdminPassword ? 'text' : 'password'}
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                      placeholder="Enter your admin password..."
                      value={revealAdminPassword}
                      onChange={(e) => setRevealAdminPassword(e.target.value)}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowRevealAdminPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                      {showRevealAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button type="submit" disabled={revealLoading} className="w-full h-10 text-xs font-semibold text-white rounded-xl bg-secondary hover:bg-secondary/90 shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                    {revealLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <><Eye size={14} /> Reveal Password</>}
                  </button>
                </form>
              )}

              {revealStep === 3 && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-semibold text-slate-800 tracking-wider select-all flex-grow">
                      {revealedPassword || '(no password stored)'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRevealedPassword}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:border-primary/30 hover:bg-primary/5 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
                      title="Copy to clipboard"
                    >
                      {revealCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">Sensitive credential — do not share in unsecured channels.</p>
                </>
              )}
            </div>

            <button type="button" onClick={() => setRevealDoc(null)} className="w-full h-11 mt-5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-md transition cursor-pointer">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Doctor Confirmation Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative w-full max-w-[420px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setDeletingDoc(null)}>×</button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-heading font-semibold text-text-primary">Delete Doctor</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary mb-5 bg-rose-50 border border-rose-200/60 rounded-xl px-4 py-3">
              Are you sure you want to delete <span className="font-bold text-rose-800">{deletingDoc.name}</span>? This will remove their record from EMR.
            </p>

            <form onSubmit={handleConfirmDeleteDoctor} className="flex flex-col gap-4">
              {deleteDocErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center">{deleteDocErr}</div>}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Your Password</label>
                <div className="relative">
                  <input
                    type={showDeleteDocPassword ? 'text' : 'password'}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 pr-10 outline-none text-text-primary focus:border-rose-400 focus:ring-3 focus:ring-rose-500/10 transition-all duration-150 text-sm"
                    placeholder="Enter your admin password..."
                    value={deleteDocPassword}
                    onChange={(e) => setDeleteDocPassword(e.target.value)}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowDeleteDocPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                    {showDeleteDocPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-1">
                <button type="button" onClick={() => setDeletingDoc(null)} className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={deleteDocLoading} className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                  {deleteDocLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : <><Trash2 size={13} /> Confirm Delete</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qualification Change Review Modal — old vs new value, Approve/Reject */}
      {reviewingQualDoc && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative w-full max-w-[420px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button
              className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer"
              onClick={() => setReviewingQualDoc(null)}
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-heading font-semibold text-text-primary">Qualification Change Request</h3>
                <p className="text-[11px] text-text-secondary mt-0.5">From: <span className="font-semibold text-slate-700">{reviewingQualDoc.name}</span></p>
              </div>
            </div>

            {reviewQualErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center mb-4">{reviewQualErr}</div>}

            <div className="flex flex-col gap-3 mb-6">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Current</span>
                <span className="text-sm text-slate-700 font-medium">
                  {reviewingQualDoc.qualification || <span className="text-slate-300 italic">Not set</span>}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600">Requested</span>
                <span className="text-sm text-amber-700 font-bold">{reviewingQualDoc.pendingQualification}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleRejectQualification(reviewingQualDoc)}
                disabled={reviewQualLoading}
                className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {reviewQualLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : 'Reject'}
              </button>
              <button
                type="button"
                onClick={() => handleApproveQualification(reviewingQualDoc)}
                disabled={reviewQualLoading}
                className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {reviewQualLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" /> : 'Approve'}
              </button>
            </div>
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
    </div>
  );
};

export default SuperAdminDoctorView;
