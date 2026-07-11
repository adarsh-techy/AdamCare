import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Edit2, Trash2 } from 'lucide-react';
import api from '../../../services/apiClient';

const AllAppointmentsView = () => {
  const [appointments, setAppointments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);

  // Editing state
  const [editingApp, setEditingApp] = useState(null);
  const [editPurpose, setEditPurpose] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editErr, setEditErr] = useState('');

  // Deletion confirmation state
  const [deletingAppId, setDeletingAppId] = useState(null);

  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.data.data))
      .catch((e) => console.error('Failed to load departments list:', e.message));
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          page,
          limit: 8,
          patientSearch,
          doctorSearch,
          status,
          department,
          sortBy: 'date',
          sortOrder: 'asc'
        }
      });
      setAppointments(res.data.data);
      setTotal(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages);
    } catch (e) {
      console.error('Failed to load appointments registry:', e.message);
    } finally {
      setLoading(false);
    }
  }, [page, patientSearch, doctorSearch, status, department]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Hook into live Socket.IO update broadcasts
  useEffect(() => {
    const handleWS = () => {
      fetchAppointments();
    };
    window.addEventListener('appointment_changed_ws', handleWS);
    return () => window.removeEventListener('appointment_changed_ws', handleWS);
  }, [fetchAppointments]);

  const handleDelete = (id) => {
    setDeletingAppId(id);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/appointments/${deletingAppId}/remove`);
      setDeletingAppId(null);
      fetchAppointments();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete appointment');
    }
  };

  const handleOpenEdit = (app) => {
    setEditingApp(app);
    setEditPurpose(app.purpose || '');
    setEditNotes(app.notes || '');
    setEditErr('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/appointments/${editingApp._id}`, {
        purpose: editPurpose,
        notes: editNotes
      });
      setEditingApp(null);
      fetchAppointments();
    } catch (err) {
      setEditErr(err.response?.data?.message || 'Failed to update appointment');
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Global Appointment Registry</h2>
      <p className="text-text-secondary text-sm mb-8">View, edit, cancel, and permanently delete appointments across EMR clinic databases.</p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <input
          type="text"
          className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
          placeholder="Search Patient (Name/ID/Phone)"
          value={patientSearch}
          onChange={(e) => { setPatientSearch(e.target.value); setPage(1); }}
        />
        <input
          type="text"
          className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
          placeholder="Search Doctor (Name)"
          value={doctorSearch}
          onChange={(e) => { setDoctorSearch(e.target.value); setPage(1); }}
        />
        <select 
          className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
          value={status} 
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="arrived">Arrived</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select 
          className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
          value={department} 
          onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept._id} value={dept.name}>{dept.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div></div>
      ) : (
        <>
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm mt-6">
            <table className="w-full text-left border-collapse">
              <thead className="bg-pink-100/50  border-b border-pink-200/80 ">
                <tr className="text-text-secondary text-xs uppercase font-bold tracking-wider">
                  <th className="py-4 px-4 font-bold text-slate-500">Date / Slot</th>
                  <th className="py-4 px-4 font-bold text-slate-500">Patient</th>
                  <th className="py-4 px-4 font-bold text-slate-500">Assigned Doctor</th>
                  <th className="py-4 px-4 font-bold text-slate-500">Department</th>
                  <th className="py-4 px-4 font-bold text-slate-500">Status</th>
                  <th className="py-4 px-4 font-bold text-slate-500">Purpose</th>
                  <th className="py-4 px-4 font-bold text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((app) => (
                  <tr key={app._id} className="border-b border-slate-200/50 hover:bg-slate-50/50 transition-colors duration-150 last:border-none">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-sm text-text-primary">{new Date(app.date).toLocaleDateString()}</div>
                      <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-0.5">
                        <Clock size={12} className="text-primary" /> {app.slot}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-sm text-text-primary">{app.patient?.name || 'Unknown Patient'}</div>
                      <div className="text-xs text-text-muted">{app.patient?.patientId || 'N/A'} | {app.patient?.mobileNumber || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-text-primary font-medium">{app.doctor?.name || 'Deleted Doctor'}</td>
                    <td className="py-4 px-4 text-sm">
                      {app.department ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                          {app.department}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        app.status === 'scheduled' ? 'bg-sky-50 text-sky-700 border border-sky-200/50' :
                        app.status === 'arrived' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                        app.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' :
                        'bg-rose-50 text-rose-700 border border-rose-200/50'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          app.status === 'scheduled' ? 'bg-sky-500' :
                          app.status === 'arrived' ? 'bg-amber-500' :
                          app.status === 'completed' ? 'bg-emerald-500' :
                          'bg-rose-500'
                        }`}></span>
                        {app.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-text-secondary max-w-[200px] truncate">{app.purpose}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(app)}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-primary/10 border border-slate-200 hover:border-primary/20 text-slate-500 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm"
                          title="Edit Details"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(app._id)}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-danger flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm"
                          title="Permanently Delete Appointment"
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

          {appointments.length === 0 && <p className="text-text-muted text-center text-sm py-12">No appointments matched the filters.</p>}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 text-sm text-text-secondary">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(page - 1)} 
                className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 shadow-sm"
              >
                Prev
              </button>
              <span>Page {page} of {totalPages} ({total} appointments)</span>
              <button 
                disabled={page === totalPages} 
                onClick={() => setPage(page + 1)} 
                className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 shadow-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Edit Appointment Details Modal */}
      {editingApp && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[450px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setEditingApp(null)}>×</button>
            
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Modify Appointment</h3>
            <p className="text-xs text-text-secondary mb-4">Patient: {editingApp.patient?.name || 'N/A'}</p>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              {editErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{editErr}</div>}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Purpose of Visit</label>
                <input 
                  type="text" 
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
                  required 
                  value={editPurpose} 
                  onChange={(e) => setEditPurpose(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Internal Notes</label>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm h-20 resize-none" 
                  value={editNotes} 
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. check vital parameters..."
                />
              </div>


              <button 
                type="submit" 
                className="w-full h-11 mt-2 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Popup */}
      {deletingAppId && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[400px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-2">Delete Appointment</h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-6">Are you sure you want to permanently delete this appointment from EMR? This slot will be freed up.</p>

            <div className="flex gap-3 w-full">
              <button 
                type="button" 
                onClick={() => setDeletingAppId(null)}
                className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDelete}
                className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllAppointmentsView;
