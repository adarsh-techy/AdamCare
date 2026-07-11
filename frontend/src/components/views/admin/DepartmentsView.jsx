import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Trash2, Pencil, Lock, Unlock } from 'lucide-react';
import api from '../../../services/apiClient';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SuperAdminDepartmentView = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [message, setMessage] = useState('');
  const [err, setErr] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit modal state
  const [editingDept, setEditingDept] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDays, setEditDays] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState('');

  // Block confirm modal state
  const [blockingDept, setBlockingDept] = useState(null);
  const [blockLoading, setBlockLoading] = useState(false);

  // Delete confirm modal state
  const [deletingDeptId, setDeletingDeptId] = useState(null);

  // Only show the spinner on first load, not on quiet background refreshes.
  const fetchDepartments = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get('/departments/admin/all');
      setDepartments(res.data.data);
    } catch (e) {
      console.error('Failed to load departments:', e.message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Let other tabs know the department list changed, so they can refresh too.
  const notifyDepartmentsChanged = () => window.dispatchEvent(new Event('departments_changed'));

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleDayToggle = (day, days, setDays) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // Create
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true); setMessage(''); setErr('');
    try {
      await api.post('/departments', { name: newDeptName });
      setMessage('Department created successfully!');
      setNewDeptName('');
      fetchDepartments(false);
      notifyDepartmentsChanged();
      setTimeout(() => { setShowCreateModal(false); setMessage(''); }, 1000);
    } catch (error) {
      setErr(error.response?.data?.message || 'Failed to create department');
    } finally { setCreateLoading(false); }
  };

  // Open edit modal
  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditDays(dept.workingDays || [1, 2, 3, 4, 5]);
    setEditErr('');
  };

  // Save edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editDays.length === 0) { setEditErr('Please select at least one working day.'); return; }
    setEditLoading(true); setEditErr('');
    try {
      await api.put(`/departments/${editingDept._id}`, { name: editName, workingDays: editDays });
      setEditingDept(null);
      fetchDepartments(false);
      notifyDepartmentsChanged();
    } catch (error) {
      setEditErr(error.response?.data?.message || 'Failed to update department');
    } finally { setEditLoading(false); }
  };

  // Block / Unblock
  const handleConfirmBlock = async () => {
    setBlockLoading(true);
    try {
      await api.put(`/departments/${blockingDept._id}`, { isActive: !blockingDept.isActive });
      setBlockingDept(null);
      fetchDepartments(false);
      notifyDepartmentsChanged();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to update department status');
    } finally {
      setBlockLoading(false);
    }
  };

  // Delete
  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/departments/${deletingDeptId}`);
      setDeletingDeptId(null);
      fetchDepartments(false);
      notifyDepartmentsChanged();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete department');
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Manage Clinic Departments</h2>
          <p className="text-text-secondary text-sm">Create, edit, block and delete medical specialties.</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setErr(''); setMessage(''); }}
          className="px-5 h-11 bg-primary text-white font-semibold rounded-xl flex items-center gap-2 shadow-[0_4px_14px_rgba(13,105,93,0.2)] hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer text-sm shrink-0"
        >
          + Create Department
        </button>
      </div>

      {/* Departments Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-heading font-semibold text-text-primary">Adam Care Department Registry</h3>
          <span className="text-xs font-semibold text-slate-400">{departments.length} department{departments.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-14">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div>
          </div>
        ) : departments.length === 0 ? (
          <p className="text-text-muted text-center text-sm py-14">No departments configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100 w-[40%]">Department</th>
                <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100 w-[15%]">Status</th>
                <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100 w-[20%]">Created</th>
                <th className="text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100 w-[25%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, idx) => (
                <tr
                  key={dept._id}
                  className={`group transition-colors duration-100 hover:bg-slate-50/40 ${idx !== departments.length - 1 ? 'border-b border-slate-100' : ''} ${dept.isActive === false ? 'bg-rose-50/30' : ''}`}
                >
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${dept.isActive === false ? 'bg-slate-200' : 'bg-gradient-to-br from-primary to-secondary'}`}>
                        <Layers size={16} color="white" />
                      </div>
                      <span className={`font-semibold text-sm ${dept.isActive === false ? 'text-slate-400' : 'text-slate-800'}`}>{dept.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${dept.isActive === false ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {dept.isActive === false ? 'Blocked' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-400">{new Date(dept.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEdit(dept)}
                        className="w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150"
                        title="Edit Department"
                      >
                        <Pencil size={13} />
                      </button>
                      {/* Block / Unblock */}
                      <button
                        onClick={() => setBlockingDept(dept)}
                        className={`w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-all duration-150 ${
                          dept.isActive === false
                            ? 'text-slate-400 hover:text-emerald-600'
                            : 'text-slate-400 hover:text-amber-600'
                        }`}
                        title={dept.isActive === false ? 'Unblock' : 'Block'}
                      >
                        {dept.isActive === false ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setDeletingDeptId(dept._id)}
                        className="w-7 h-7 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-danger flex items-center justify-center cursor-pointer transition-all duration-150"
                        title="Delete Department"
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
        )}
      </div>

      {/* Create Department Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[9999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative w-full max-w-[460px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setShowCreateModal(false)}>x</button>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Create Department</h3>
            <p className="text-xs text-text-secondary mb-6">Set the department name.</p>
            <form onSubmit={handleCreate} className="flex flex-col gap-5">
              {message && <div className="bg-success-bg text-success border border-success/15 p-3 rounded-lg text-sm text-center">{message}</div>}
              {err && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{err}</div>}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department Name</label>
                <input type="text" placeholder="e.g. Dermatology" className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" required value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
              </div>
              <button type="submit" disabled={createLoading} className="w-full h-12 mt-1 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm">
                {createLoading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Create Department'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {editingDept && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[9999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative w-full max-w-[460px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setEditingDept(null)}>x</button>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Edit Department</h3>
            <p className="text-xs text-text-secondary mb-6">Update the department name and working days.</p>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
              {editErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{editErr}</div>}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department Name</label>
                <input type="text" className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" required value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Working Days</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDayToggle(idx, editDays, setEditDays)}
                      className={`w-10 h-9 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                        editDays.includes(idx)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-text-secondary border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={editLoading} className="w-full h-12 mt-1 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm">
                {editLoading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Block / Unblock Confirmation Modal */}
      {blockingDept && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl w-full max-w-[400px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] text-center flex flex-col items-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${blockingDept.isActive === false ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">{blockingDept.isActive === false ? 'Unblock Department' : 'Block Department'}</h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">
              {blockingDept.isActive === false
                ? `Are you sure you want to unblock "${blockingDept.name}"? It will be marked as active again.`
                : `Are you sure you want to block "${blockingDept.name}"? It will be marked as inactive.`}
            </p>
            <div className="flex gap-3 w-full">
              <button type="button" disabled={blockLoading} onClick={() => setBlockingDept(null)} className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
              <button type="button" disabled={blockLoading} onClick={handleConfirmBlock} className={`flex-grow h-11 text-xs font-semibold text-white rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${blockingDept.isActive === false ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                {blockLoading
                  ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white"></div>
                  : (blockingDept.isActive === false ? 'Confirm Unblock' : 'Confirm Block')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDeptId && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl w-full max-w-[400px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">Delete Department</h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">Are you sure you want to delete this department? Doctors assigned to it will not be deleted but their department listing may become invalid.</p>
            <div className="flex gap-3 w-full">
              <button type="button" onClick={() => setDeletingDeptId(null)} className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200">Cancel</button>
              <button type="button" onClick={handleConfirmDelete} className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer">Delete Department</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDepartmentView;
