import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Calendar, Clock } from 'lucide-react';
import api from '../../../services/apiClient';

const SearchPatientsView = () => {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState([]);

  // History modal states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    api.get('/departments')
      .then((res) => setDepartments(res.data.data))
      .catch((e) => console.error('Failed to load departments:', e.message));
  }, []);

  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await api.get('/appointments/patients/search', {
        params: {
          q: query.trim() || undefined,
          date: dateFilter || undefined,
          department: departmentFilter || undefined
        }
      });
      setPatients(res.data.data);
    } catch (err) {
      console.error('Failed to search patients:', err.message);
    } finally {
      setLoading(false);
    }
  }, [query, dateFilter, departmentFilter]);

  // Trigger search on typing debounce/effects or submit
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [handleSearch]);

  const loadPatientHistory = useCallback(async (patient) => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    try {
      // Find appointments matching the patientId
      const res = await api.get('/appointments', {
        params: {
          patientSearch: patient.patientId,
          limit: 100
        }
      });
      setHistory(res.data.data);
    } catch (err) {
      console.error('Failed to load clinical history:', err.message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Hook into live Socket.IO update broadcasts — without this, a delete (or
  // any other change) made elsewhere (e.g. Global Appointment Registry)
  // never reaches this view: the patient list's visit counts and an
  // already-open history modal would keep showing stale data indefinitely.
  useEffect(() => {
    const handleWS = () => {
      handleSearch();
      if (selectedPatient) loadPatientHistory(selectedPatient);
    };
    window.addEventListener('appointment_changed_ws', handleWS);
    return () => window.removeEventListener('appointment_changed_ws', handleWS);
  }, [handleSearch, loadPatientHistory, selectedPatient]);

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Search Adam Care Patient Records</h2>
      <p className="text-text-secondary text-sm mb-8">Lookup registered patient files and view their clinical check-up histories.</p>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-3 items-center mb-3 flex-wrap">
        <div className="relative flex-grow min-w-[220px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            className="w-full bg-white border border-slate-200 rounded-lg p-3 pl-11 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
            placeholder="Search patients by Name, Patient ID, or Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          title="Filter by visit date"
          className="h-12 px-4 bg-white border border-slate-200 rounded-lg outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm cursor-pointer"
        />
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="h-12 px-4 bg-white border border-slate-200 rounded-lg outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm cursor-pointer"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d.name}>{d.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="h-12 px-6 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(2,132,199,0.2)] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(2,132,199,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm"
        >
          Search
        </button>
      </form>

      <div className="min-h-0 mb-6">
        {(dateFilter || departmentFilter) && (
          <div className="flex items-center gap-2 flex-wrap">
            {dateFilter && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                Visit date: {new Date(dateFilter + 'T00:00:00').toLocaleDateString()}
                <button type="button" onClick={() => setDateFilter('')} className="cursor-pointer font-bold leading-none">×</button>
              </span>
            )}
            {departmentFilter && (
              <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                Dept: {departmentFilter}
                <button type="button" onClick={() => setDepartmentFilter('')} className="cursor-pointer font-bold leading-none">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div></div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-400">Registry Matches</h3>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
              {patients.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-pink-100/50">
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Patient ID</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Patient</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Gender / Age</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Contact Info</th>
                  <th className="text-left text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 py-3 border-b border-slate-100">Visits</th>
                  <th className="text-right text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-6 py-3 border-b border-slate-100">Records</th>
                </tr>
              </thead>
              <tbody>
                {patients
                  .map((pat) => (
                    <tr key={pat._id} className="group hover:bg-slate-50/60 border-b border-slate-100/80 transition-colors duration-100">
                      {/* Patient ID */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono font-extrabold bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg">
                          {pat.patientId}
                        </span>
                      </td>

                      {/* Patient Name with Initial Avatar */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {pat.name?.charAt(0) || 'P'}
                          </div>
                          <span className="font-semibold text-slate-800">{pat.name}</span>
                        </div>
                      </td>

                      {/* Gender / Age */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-700 font-medium">{pat.gender}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          <span className="text-xs text-slate-500 font-semibold">
                            {pat.dob ? (new Date().getFullYear() - new Date(pat.dob).getFullYear()) : 'N/A'} yrs
                          </span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="px-4 py-4">
                        <div className="text-xs font-medium text-slate-700">{pat.mobileNumber}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pat.email || 'No email registered'}</div>
                      </td>

                      {/* Visits Badge */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full self-start inline-block">
                            {pat.completedVisits || 0} completed
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-medium">
                            {pat.totalVisits || 0} total visits
                          </span>
                        </div>
                      </td>

                      {/* View Records Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => loadPatientHistory(pat)}
                          className="px-3.5 h-8 text-xs font-bold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-primary hover:text-white hover:border-primary shadow-sm cursor-pointer transition-all duration-150 flex items-center gap-1.5 ml-auto"
                        >
                          <Eye size={12} />
                          Clinical History
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {patients.length === 0 && (
              <p className="text-text-muted text-center text-sm py-12">No patients found in the EMR registry.</p>
            )}
          </div>
        </div>
      )}

      {/* History Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-[slideUp_0.2s_ease-out] max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-heading font-semibold text-text-primary">Clinical Visitation File & Patient Details</h3>
                <p className="text-xs text-text-secondary">Comprehensive EMR registry file record.</p>
              </div>
              <button 
                onClick={() => setSelectedPatient(null)}
                className="text-text-muted hover:text-text-primary text-xl font-bold bg-transparent border-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Patient Detailed Demographics Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-xs text-text-secondary">
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Patient ID</span>
                <span className="font-bold text-sm text-primary">{selectedPatient.patientId}</span>
              </div>
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Full Name</span>
                <span className="font-semibold text-sm text-text-primary">{selectedPatient.name}</span>
              </div>
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Gender / Age</span>
                <span className="font-semibold text-sm text-text-primary">
                  {selectedPatient.gender} ({selectedPatient.dob ? (new Date().getFullYear() - new Date(selectedPatient.dob).getFullYear()) : 'N/A'} yrs)
                </span>
              </div>
              <div>
                <span className="block font-bold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Contact Details</span>
                <span className="font-semibold text-sm text-text-primary">{selectedPatient.mobileNumber}</span>
                {selectedPatient.email && <span className="block text-[10px] text-slate-400 mt-0.5">{selectedPatient.email}</span>}
              </div>
            </div>

            <div className="overflow-y-auto flex-grow pr-1 my-2">
              {loadingHistory ? (
                <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div></div>
              ) : (
                <div className="flex flex-col gap-4">
                  {history.map((app) => (
                    <div key={app._id} className="border border-slate-200/70 rounded-xl p-4 flex flex-col gap-2.5 shadow-sm bg-slate-50/30">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-text-primary">{app.doctor?.name || 'Deleted Doctor'}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{app.department}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-secondary">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(app.date).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Clock size={12} /> {app.slot}</span>
                          </div>
                        </div>

                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          app.status === 'scheduled' ? 'bg-sky-100 text-sky-700' :
                          app.status === 'arrived' ? 'bg-amber-100 text-amber-700' :
                          app.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>{app.status}</span>
                      </div>

                      <div className="border-t border-slate-200/50 pt-2 flex flex-col gap-1.5">
                        <div className="text-xs text-text-secondary"><span className="font-bold">Purpose:</span> {app.purpose}</div>
                        {app.status === 'completed' && app.notes && (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-950 mt-1.5">
                            <div className="font-bold text-emerald-800 mb-1">SOAP Doctor Consult Notes:</div>
                            <div className="whitespace-pre-line">{app.notes}</div>
                          </div>
                        )}
                        {app.status !== 'completed' && app.notes && (
                          <div className="text-xs text-text-secondary"><span className="font-bold">Check-in Notes:</span> {app.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}

                  {history.length === 0 && (
                    <p className="text-text-muted text-center text-sm py-12">No appointments exist in this patient's medical records registry.</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4 mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-5 h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                Close File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPatientsView;
