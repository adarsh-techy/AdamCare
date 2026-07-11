import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Search, RefreshCw, Edit2 } from 'lucide-react';
import api from '../../../services/apiClient';
import { getTodayDateStr } from '../../../utils/date';

const ReceptionistPlannerView = () => {
  const [appointments, setAppointments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [selectedDate]);

  // Edit states
  const [editingApp, setEditingApp] = useState(null);
  const [editPurpose, setEditPurpose] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState('');

  // Cancellation states
  const [cancellingAppId, setCancellingAppId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchAppointments = useCallback(async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          startDate: selectedDate,
          endDate: selectedDate,
          patientSearch: searchQuery
        }
      });
      setAppointments(res.data.data);
    } catch (e) {
      console.error('Failed to load worklist:', e.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedDate]);

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

  const handleArrived = async (id) => {
    try {
      await api.post(`/appointments/${id}/arrive`);
      fetchAppointments();
    } catch (e) {
      alert(e.response?.data?.message || 'Error marking arrival');
    }
  };

  const handleCancelClick = (id) => {
    setCancellingAppId(id);
    setCancelReason('');
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason.');
      return;
    }
    try {
      await api.delete(`/appointments/${cancellingAppId}`, { data: { reason: cancelReason } });
      setCancellingAppId(null);
      fetchAppointments();
    } catch (e) {
      alert(e.response?.data?.message || 'Error cancelling appointment');
    }
  };

  const handleEditClick = (app) => {
    setEditingApp(app);
    setEditPurpose(app.purpose || '');
    setEditNotes(app.notes || '');
    setEditErr('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditErr('');
    try {
      await api.put(`/appointments/${editingApp._id}`, {
        purpose: editPurpose,
        notes: editNotes
      });
      setEditingApp(null);
      fetchAppointments();
    } catch (err) {
      setEditErr(err.response?.data?.message || 'Failed to update appointment details.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-3xl font-heading font-bold text-text-primary">Daily Reception Planner</h2>
        <button
          onClick={fetchAppointments}
          className="p-2 hover:bg-slate-100 text-text-secondary hover:text-text-primary rounded-xl border border-slate-200/60 bg-white transition shadow-sm cursor-pointer"
          title="Force Sync Now"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <p className="text-text-secondary text-sm mb-8">Manage patient arrivals, process check-ins, modify purpose files, and handle slot cancellations.</p>

      {/* Search + Date Bar */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Search by Patient Name, ID, mobile number..."
            className="w-full pl-12 pr-4 h-12 bg-white border border-slate-200/80 rounded-xl outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-12 px-4 bg-white border border-slate-200/80 rounded-xl outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 shadow-sm cursor-pointer"
        />
        {selectedDate !== getTodayDateStr() && (
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayDateStr())}
            className="h-12 px-4 bg-white border border-slate-200/80 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-all duration-150 shadow-sm cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 border-t-primary-light"></div></div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">
              {selectedDate === getTodayDateStr() ? "Today's Appointments" : `Appointments · ${formattedSelectedDate}`}
            </h3>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
              {appointments.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-pink-100/50">
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Slot</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Patient</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Assigned Doctor</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Purpose / Notes</th>
                  <th className="text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Status</th>
                  <th className="text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((app) => (
                  <tr key={app._id} className="group hover:bg-slate-50/60 border-b border-slate-100/80 transition-colors duration-100">
                    {/* Time Slot */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-bold text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg w-fit">
                        <Clock size={12} />
                        {app.slot}
                      </div>
                    </td>

                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{app.patient?.name || 'Unknown Patient'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {app.patient?.patientId || 'N/A'} • {app.patient?.mobileNumber || 'N/A'}
                      </div>
                    </td>

                    {/* Doctor and Department */}
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-800 text-xs">{app.doctor?.name || 'Deleted Doctor'}</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-pink-100 border border-pink-200/50 text-pink-700 mt-1 uppercase tracking-widest">
                        {app.department}
                      </span>
                    </td>

                    {/* Purpose / Notes */}
                    <td className="px-4 py-4 text-xs text-slate-500">
                      <div className="font-medium text-slate-700 line-clamp-1 max-w-[220px]">{app.purpose}</div>
                      {app.notes && (
                        <div className="text-[10px] text-slate-400 italic mt-0.5 truncate max-w-[200px]">
                          Notes: {app.notes}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 text-center">
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

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {app.status === 'scheduled' && (
                          <button
                            onClick={() => handleArrived(app._id)}
                            className="h-8 px-3 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/40 cursor-pointer transition shadow-sm"
                          >
                            Mark Arrived
                          </button>
                        )}
                        {app.status !== 'cancelled' && app.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => handleEditClick(app)}
                              className="w-8 h-8 rounded-lg bg-white hover:bg-primary/10 border border-slate-200 hover:border-primary/20 text-slate-500 hover:text-primary flex items-center justify-center cursor-pointer transition shadow-sm"
                              title="Edit Details"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleCancelClick(app._id)}
                              className="h-8 px-3 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/40 cursor-pointer transition shadow-sm"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-text-muted text-center text-sm py-12">
                      {selectedDate === getTodayDateStr() ? 'No appointments scheduled for today.' : `No appointments scheduled for ${formattedSelectedDate}.`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Appointment Details Modal */}
      {editingApp && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[450px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setEditingApp(null)}>×</button>
            
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Modify Appointment</h3>
            
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4 mt-4">
              {editErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm text-center">{editErr}</div>}

              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-text-secondary font-semibold">Patient</p>
                <p className="text-sm font-semibold text-text-primary">{(editingApp.patient?.name) || 'Unknown Patient'} ({(editingApp.patient?.patientId) || 'N/A'})</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-text-secondary font-semibold">Doctor & Slot</p>
                <p className="text-sm font-semibold text-text-primary">{(editingApp.doctor?.name) || 'Deleted Doctor'} at {editingApp.slot}</p>
              </div>

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
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notes</label>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm min-h-[80px] resize-none" 
                  value={editNotes} 
                  onChange={(e) => setEditNotes(e.target.value)} 
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 h-11 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {editLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-primary-light"></div> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal Popup */}
      {cancellingAppId && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[400px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out]">
            <button className="absolute right-5 top-5 bg-transparent border-none text-text-secondary hover:text-text-primary text-xl cursor-pointer" onClick={() => setCancellingAppId(null)}>×</button>
            
            <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">Cancel Appointment</h3>
            <p className="text-xs text-text-secondary mb-5">Please specify the reason for cancelling this slot.</p>

            <form onSubmit={handleConfirmCancel} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Reason for Cancellation</label>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm h-24 resize-none" 
                  required 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  placeholder="e.g. Patient requested reschedule, emergency duty change..."
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
                <button 
                  type="button" 
                  onClick={() => setCancellingAppId(null)}
                  className="px-4 h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  className="px-5 h-11 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 shadow-md transition cursor-pointer"
                >
                  Cancel Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistPlannerView;
