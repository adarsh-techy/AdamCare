import React, { useState, useEffect, useCallback } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import api from '../../../services/apiClient';
import { getTodayDateStr } from '../../../utils/date';

const SchedulerGridView = () => {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  
  const [workingDay, setWorkingDay] = useState(true);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking form states
  const [bookingSlot, setBookingSlot] = useState(null);
  const [patientType, setPatientType] = useState('existing');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');

  // New Patient states
  const [newPatName, setNewPatName] = useState('');
  const [newPatMobile, setNewPatMobile] = useState('');
  const [newPatAge, setNewPatAge] = useState('');
  const [newPatGender, setNewPatGender] = useState('Male');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  const [bookingErr, setBookingErr] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    api.get('/departments')
      .then((res) => {
        setDepartments(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedDept(res.data.data[0].name);
        }
      })
      .catch((e) => console.error('Failed to load departments:', e.message));

    api.get('/doctors')
      .then((res) => {
        setDoctors(res.data.data);
      })
      .catch((e) => console.error('Failed to retrieve doctors:', e.message));
  }, []);

  const deptDoctors = doctors.filter(doc => doc.department === selectedDept);

  useEffect(() => {
    if (deptDoctors.length > 0) {
      setSelectedDoc(deptDoctors[0]._id);
    } else {
      setSelectedDoc('');
    }
  }, [selectedDept, doctors]);

  const fetchSlots = useCallback(async () => {
    if (!selectedDoc || !selectedDate) {
      setSlots([]);
      return;
    }
    // Prevent fetching if date is incomplete/invalid during manual user typing
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return;
    }
    setLoadingSlots(true);
    try {
      const res = await api.get('/slots', {
        params: {
          doctorId: selectedDoc,
          date: selectedDate
        }
      });
      setWorkingDay(res.data.data.workingDay);
      setUnavailableReason(res.data.data.reason || '');
      setSlots(res.data.data.slots);
    } catch (e) {
      setWorkingDay(false);
      setUnavailableReason('');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDoc, selectedDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Hook into live Socket.IO update broadcasts
  useEffect(() => {
    const handleWS = () => {
      fetchSlots();
    };
    window.addEventListener('appointment_changed_ws', handleWS);
    window.addEventListener('schedule_changed_ws', handleWS);
    return () => {
      window.removeEventListener('appointment_changed_ws', handleWS);
      window.removeEventListener('schedule_changed_ws', handleWS);
    };
  }, [fetchSlots]);

  useEffect(() => {
    if (patientType !== 'existing' || patientSearchQuery.length < 2) {
      setFoundPatients([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      api.get('/appointments/patients/search', { params: { q: patientSearchQuery } })
        .then((res) => {
          setFoundPatients(res.data.data);
        })
        .catch((e) => console.error(e));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearchQuery, patientType]);

  const handleOpenBooking = (slotTime) => {
    setBookingSlot(slotTime);
    setBookingErr('');
    setBookingSuccess('');
  };

  const handleCloseBooking = () => {
    setBookingSlot(null);
    setSelectedPatientId('');
    setPatientSearchQuery('');
    setNewPatName('');
    setNewPatMobile('');
    setNewPatAge('');
    setPurpose('');
    setNotes('');
  };

  const handleBook = async (e) => {
    e.preventDefault();
    if (bookingLoading) return;
    setBookingErr('');
    setBookingSuccess('');

    const payload = {
      doctorId: selectedDoc,
      date: selectedDate,
      slot: bookingSlot,
      purpose,
      notes,
      patientType
    };

    if (patientType === 'existing') {
      if (!selectedPatientId) {
        setBookingErr('Please select a patient from the list.');
        return;
      }
      payload.patientId = selectedPatientId;
    } else {
      if (!newPatName || !newPatMobile || !newPatAge) {
        setBookingErr('Please fill in Name, Mobile and Age for the new patient.');
        return;
      }
      if (newPatMobile.length !== 10) {
        setBookingErr('Mobile number must be exactly 10 digits.');
        return;
      }
      payload.patientName = newPatName;
      payload.patientMobile = newPatMobile;

      const currentYear = new Date().getFullYear();
      const birthYear = currentYear - parseInt(newPatAge, 10);
      payload.patientDob = `${birthYear}-01-01`;
      payload.patientGender = newPatGender;
    }

    setBookingLoading(true);
    try {
      await api.post('/appointments', payload);
      setBookingSuccess('Appointment booked successfully!');

      // Close booking modal immediately
      setBookingSlot(null);
      setSelectedPatientId('');
      setPatientSearchQuery('');
      setNewPatName('');
      setNewPatMobile('');
      setNewPatAge('');
      setPurpose('');
      setNotes('');

      fetchSlots();

      setTimeout(() => {
        setBookingSuccess('');
      }, 1500);
    } catch (e) {
      setBookingErr(e.response?.data?.message || 'Double booking occurred. This slot is no longer available.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Book Adam Care Appointment</h2>
      <p className="text-text-secondary text-sm mb-8">Select doctor, picker date, and choose from the generated dynamic time slots grid.</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-[150px] flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Department</label>
          <select 
            className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
            value={selectedDept} 
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[180px] flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Doctor</label>
          <select 
            className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm" 
            value={selectedDoc} 
            onChange={(e) => setSelectedDoc(e.target.value)}
          >
            {deptDoctors.length === 0 ? (
              <option value="">No Doctors in Dept</option>
            ) : (
              deptDoctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)
            )}
          </select>
        </div>

        <div className="flex-1 min-w-[150px] flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Appointment Date</label>
          <input
            type="date"
            min={todayStr}
            className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value && e.target.value < todayStr) return;
              setSelectedDate(e.target.value);
            }}
          />
        </div>
      </div>

      {/* Selected Doctor Profile Card */}
      {(() => {
        const selectedDocObj = deptDoctors.find(d => d._id === selectedDoc);
        if (!selectedDocObj) return null;
        return (
          <div className="flex items-center gap-4 bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-sm mb-2">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm shrink-0 bg-white flex items-center justify-center">
              {selectedDocObj.avatar ? (
                <img src={selectedDocObj.avatar} alt={selectedDocObj.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {selectedDocObj.name?.charAt(0) || 'D'}
                  </span>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex flex-col">
              <p className="text-base font-bold text-slate-800 leading-tight">{selectedDocObj.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{selectedDocObj.department}</p>
              {selectedDocObj.specialization && (
                <span className="mt-1.5 text-[9px] font-extrabold uppercase tracking-widest text-primary/80 bg-primary/5 border border-primary/10 px-2 py-0.5 rounded-full w-fit">
                  {selectedDocObj.specialization}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-heading font-semibold text-text-primary">Generated Time Slots</h3>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded bg-success/15 border border-success"></div>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <div className="w-3 h-3 rounded bg-rose-50 border border-rose-200"></div>
              <span>Booked</span>
            </div>
          </div>
        </div>

        <div className={`relative min-h-[140px] mt-4 transition-all duration-200 ${loadingSlots ? 'opacity-60 pointer-events-none' : ''}`}>
          {loadingSlots && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-10 rounded-xl">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-slate-200 border-t-primary-light"></div>
            </div>
          )}

          {!workingDay ? (
            <div className="flex items-center gap-4 p-6 bg-danger-bg/5 border border-danger/20 rounded-xl">
              <AlertCircle size={24} className="text-danger" />
              <div>
                <h4 className="font-semibold text-sm text-text-primary">Doctor Not Available</h4>
                <p className="text-xs text-text-secondary mt-0.5">
                  {unavailableReason === 'department_closed'
                    ? "This doctor's department is currently blocked/closed. Unblock it in Manage Clinic Departments to allow bookings."
                    : "The doctor does not work on this day of the week, and no exception is configured for this date."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
              {slots.map((s) => {
                let cellClass = "p-3 py-3.5 rounded-lg border flex flex-col items-center justify-center transition-all duration-150 text-xs gap-1 font-semibold";
                let isClickable = s.isAvailable;

                if (s.isBooked) {
                  cellClass += " border-rose-200 bg-rose-50 text-rose-700 cursor-not-allowed";
                } else if (s.inBreak) {
                  cellClass += " border-orange-200 bg-orange-100 text-orange-700 cursor-not-allowed";
                } else if (s.isAvailable) {
                  cellClass += " border-success/30 bg-success/10 text-success hover:bg-success/20 hover:shadow-lg cursor-pointer";
                }

                return (
                  <button
                    key={s.time}
                    type="button"
                    className={cellClass}
                    onClick={() => isClickable && handleOpenBooking(s.time)}
                    disabled={!isClickable}
                  >
                    <Clock size={14} className="mb-0.5" />
                    <span className="text-sm font-bold">{s.time}</span>
                    <span className="text-[9px] uppercase tracking-wider opacity-75 mt-0.5">
                      {s.isBooked ? 'Booked' : s.inBreak ? 'Breaks' : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {bookingSlot && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 animate-[fadeIn_0.15s_ease-out] backdrop-blur-sm">
          <div className="bg-white border border-slate-200/80 shadow-2xl relative overflow-hidden w-full max-w-[500px] p-4 sm:p-8 rounded-2xl">
            <button className="absolute right-6 top-6 bg-transparent border-none text-text-secondary hover:text-text-primary text-2xl cursor-pointer" onClick={handleCloseBooking}>×</button>
            
            <h3 className="text-xl font-heading font-semibold text-text-primary mb-1">Create Booking: {bookingSlot}</h3>
            <p className="text-xs text-text-secondary mb-6">Fill in details to secure this reservation.</p>

            <form onSubmit={handleBook}>
              {bookingErr && <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm mb-4 text-center">{bookingErr}</div>}

              <div className="flex gap-5 mb-5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary">
                  <input
                    type="radio"
                    name="patType"
                    checked={patientType === 'existing'}
                    onChange={() => setPatientType('existing')}
                  />
                  <span>Existing Patient</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary">
                  <input
                    type="radio"
                    name="patType"
                    checked={patientType === 'new'}
                    onChange={() => setPatientType('new')}
                  />
                  <span>New Patient</span>
                </label>
              </div>

              {patientType === 'existing' && (
                <div className="mb-5 relative">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Search Patient</label>
                    <input
                      type="text"
                      className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                      placeholder="Type Name, Patient ID, or Phone..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  {foundPatients.length > 0 && (
                    <div className="absolute w-full mt-1 bg-white border border-slate-200 rounded-lg max-h-[180px] overflow-y-auto z-[100] shadow-2xl pr-1">
                      {foundPatients.map((p) => (
                        <div
                          key={p._id}
                          className={`p-2.5 text-xs cursor-pointer hover:bg-primary/10 hover:text-text-primary transition-colors duration-100 ${
                            selectedPatientId === p.patientId ? 'text-white bg-primary font-bold' : 'text-text-secondary'
                          }`}
                          onClick={() => {
                            setSelectedPatientId(p.patientId);
                            setPatientSearchQuery(`${p.name} (${p.patientId})`);
                            setFoundPatients([]);
                          }}
                        >
                          <span className="font-semibold text-text-primary">{p.name}</span> | {p.patientId} | {p.mobileNumber}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {patientType === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Name</label>
                    <input type="text" placeholder="e.g. John Doe" className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary text-xs" required value={newPatName} onChange={(e) => setNewPatName(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Mobile No</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary text-xs"
                      required
                      value={newPatMobile}
                      onChange={(e) => setNewPatMobile(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Age</label>
                    <input type="number" placeholder="e.g. 28" min="0" max="120" className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary text-xs" required value={newPatAge} onChange={(e) => setNewPatAge(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Gender</label>
                    <select className="bg-white border border-slate-200 rounded-lg p-2.5 outline-none text-text-primary text-xs text-text-secondary" value={newPatGender} onChange={(e) => setNewPatGender(e.target.value)}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="mb-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Purpose of Appointment</label>
                <input
                  type="text"
                  className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                  placeholder="e.g. Regular health checkup..."
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
                />
              </div>

              <div className="mb-4 flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">General Notes (Optional)</label>
                <textarea
                  className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm h-16 resize-none"
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={handleCloseBooking} className="bg-white border border-slate-200 hover:bg-slate-50 text-text-secondary hover:text-text-primary px-4 py-2.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-150">Cancel</button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-fit px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/20 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {bookingLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div> : null}
                  {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Booking Success Modal Popup Overlay */}
      {bookingSuccess && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-[scaleIn_0.2s_ease-out]">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Appointment Confirmed</h3>
            <p className="text-xs text-slate-500">{bookingSuccess}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulerGridView;
