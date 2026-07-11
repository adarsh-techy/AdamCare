import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Clock, FileText, CheckCircle } from 'lucide-react';
import api from '../../../services/apiClient';
import { getTodayDateStr } from '../../../utils/date';

const DoctorConsultationView = () => {
  const { user } = useSelector((state) => state.auth);

  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [statusFilter, setStatusFilter] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Soap Notes modal
  const [activeApp, setActiveApp] = useState(null);
  const [consultNotes, setConsultNotes] = useState('');
  const [editorSuccess, setEditorSuccess] = useState('');
  const [editorErr, setEditorErr] = useState('');
  const [completing, setCompleting] = useState(false);

  const fetchMyAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/appointments', {
        params: {
          doctorId: user?.id,
          startDate: selectedDate,
          endDate: selectedDate,
          status: statusFilter || undefined
        }
      });
      setAppointments(res.data.data);
    } catch (e) {
      console.error('Failed to load doctor visit worklist:', e.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate, statusFilter]);

  useEffect(() => {
    if (user?.id) {
      fetchMyAppointments();
    }
  }, [user, selectedDate, fetchMyAppointments]);

  // Hook into live Socket.IO update broadcasts
  useEffect(() => {
    const handleWS = () => {
      fetchMyAppointments();
    };
    window.addEventListener('appointment_changed_ws', handleWS);
    return () => window.removeEventListener('appointment_changed_ws', handleWS);
  }, [fetchMyAppointments]);

  // Also refresh every 20 seconds in case the live update was missed.
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.id) fetchMyAppointments();
    }, 20000);
    return () => clearInterval(interval);
  }, [user, fetchMyAppointments]);

  const handleOpenConsultation = (app) => {
    setActiveApp(app);
    setConsultNotes(app.notes || '');
    setEditorSuccess('');
    setEditorErr('');
  };

  const handleCloseConsultation = () => {
    setActiveApp(null);
    setConsultNotes('');
  };

  const handleSaveNotesOnly = async () => {
    setEditorErr('');
    setEditorSuccess('');
    try {
      await api.put(`/appointments/${activeApp._id}`, { notes: consultNotes });
      setEditorSuccess('Consultation notes saved successfully.');
      fetchMyAppointments();
    } catch (e) {
      setEditorErr('Failed to save notes.');
    }
  };

  const handleCompleteAppointment = async (e) => {
    e.preventDefault();
    if (completing) return;
    setEditorErr('');
    setEditorSuccess('');
    setCompleting(true);
    try {
      await api.post(`/appointments/${activeApp._id}/complete`, { notes: consultNotes });
      setEditorSuccess('Appointment marked as Completed.');
      fetchMyAppointments();
      setTimeout(() => {
        handleCloseConsultation();
      }, 1500);
    } catch (e) {
      console.error('Failed to complete appointment:', e.response?.status, e.response?.data);
      setEditorErr(e.response?.data?.message || 'Failed to complete appointment.');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-slate-100 pb-4 gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Doctor Consultation Worklist</h2>
          <p className="text-text-secondary text-sm">View your scheduled patient visits, read demographic files, and save clinical SOAP notes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-xl outline-none text-xs text-text-primary font-semibold shadow-sm focus:border-primary-light focus:ring-2 focus:ring-primary/10 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-xl outline-none text-xs text-text-primary font-semibold shadow-sm focus:border-primary-light focus:ring-2 focus:ring-primary/10 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mt-4">
            <thead >
              <tr className="border-b border-slate-200 text-text-secondary text-xs uppercase font-bold tracking-wider">
                <th className="pb-3 px-4">Time Slot</th>
                <th className="pb-3 px-4">Patient ID</th>
                <th className="pb-3 px-4">Patient Name</th>
                <th className="pb-3 px-4">Reason for Visit</th>
                <th className="pb-3 px-4">Status</th>
                <th className="pb-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((app) => (
                <tr key={app._id} className="border-b border-slate-100 hover:bg-slate-50/50 h-[65px] transition-colors duration-150">
                  <td className="px-4">
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-text-primary">
                      <Clock size={14} className="text-primary" />
                      {app.slot}
                    </div>
                  </td>
                  <td className="px-4 text-sm text-text-primary">{app.patient?.patientId || 'N/A'}</td>
                  <td className="px-4">
                    <div className="font-semibold text-sm text-text-primary">{app.patient?.name || 'Unknown Patient'}</div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      Age: {app.patient?.dob ? (new Date().getFullYear() - new Date(app.patient.dob).getFullYear()) : 'N/A'} | {app.patient?.gender || 'N/A'}
                    </div>
                  </td>
                  <td className="px-4 text-sm text-text-secondary">{app.purpose}</td>
                  <td className="px-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'scheduled' ? 'bg-sky-100 text-sky-700' :
                      app.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
                      app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>{app.status}</span>
                  </td>
                  <td className="px-4 text-right">
                    {app.status !== 'cancelled' && (
                      <button
                        onClick={() => handleOpenConsultation(app)}
                        className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-text-secondary hover:text-text-primary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-150"
                      >
                        <FileText size={14} />
                        <span>SOAP Notes</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && (
            <p className="text-text-muted text-center text-sm py-12">
              {statusFilter ? `No ${statusFilter} appointments for this date.` : 'No appointments scheduled for you today.'}
            </p>
          )}
        </div>
      )}

      {activeApp && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[600px] p-8 rounded-2xl">
            <button className="absolute right-6 top-6 bg-transparent border-none text-text-secondary hover:text-text-primary text-2xl cursor-pointer" onClick={handleCloseConsultation}>×</button>
            
            <h3 className="text-xl font-heading font-semibold text-text-primary mb-1">Clinical Session: {activeApp.patient?.name || 'Unknown Patient'}</h3>
            <p className="text-xs text-text-secondary mb-6">ID: {activeApp.patient?.patientId || 'N/A'} | Reason: {activeApp.purpose}</p>

            <div className="mt-4">
              {editorSuccess && <div className="bg-success-bg text-success border border-success/15 p-3 rounded-lg text-sm mb-4 text-center">{editorSuccess}</div>}
              {editorErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm mb-4 text-center">{editorErr}</div>}

              <div className="mb-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Consultation / SOAP Notes</label>
                <textarea
                  className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm h-56 resize-none leading-relaxed"
                  placeholder="S: Patient reports chest discomfort...&#10;O: BP 120/80...&#10;A: Cardio strain...&#10;P: Prescribed Aspirin..."
                  value={consultNotes}
                  onChange={(e) => setConsultNotes(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between mt-6">
                <button type="button" onClick={handleSaveNotesOnly} className="bg-white border border-slate-200 hover:bg-slate-50 text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-150 shadow-sm">
                  Save Draft
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCloseConsultation} className="bg-white border border-slate-200 hover:bg-slate-50 text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-150 shadow-sm">Close</button>
                  <button
                    onClick={handleCompleteAppointment}
                    className="w-fit px-4 py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-sky-500/10 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={activeApp.status === 'completed' || completing}
                  >
                    <CheckCircle size={16} />
                    <span>{completing ? 'Completing...' : 'Complete Consultation'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorConsultationView;
