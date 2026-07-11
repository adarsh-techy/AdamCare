import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, ClipboardList, Clock, PlusCircle, User, Search } from 'lucide-react';
import api from '../../../services/apiClient';
import { getTodayDateStr } from '../../../utils/date';

const Overview = ({ user, setActiveTab }) => {
  const [appointments, setAppointments] = useState([]);
  const [doctorsList, setDoctorsList] = useState([]);

  // Calendar Widget states
  const [calDate, setCalDate] = useState(new Date());
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const fetchDateData = useCallback(async (dateStr) => {
    try {
      // 1. Fetch appointments for the given date (backend auto-scopes to
      // only this doctor's own appointments when the requester is a doctor)
      const appRes = await api.get('/appointments', {
        params: {
          startDate: dateStr,
          endDate: dateStr,
          limit: 100
        }
      });
      setAppointments(appRes.data.data);

      // 2. Fetch doctors to map their profiles — only needed for the
      // clinic-wide "Doctor Workloads" widget (admin/receptionist view)
      if (user.role !== 'doctor') {
        const docRes = await api.get('/doctors');
        setDoctorsList(docRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load overview data:', e.message);
    }
  }, [user.role]);

  useEffect(() => {
    fetchDateData(selectedDate);
  }, [fetchDateData, selectedDate]);

  // Hook into live Socket.IO update broadcasts
  useEffect(() => {
    const handleWS = () => {
      fetchDateData(selectedDate);
    };
    window.addEventListener('appointment_changed_ws', handleWS);
    return () => window.removeEventListener('appointment_changed_ws', handleWS);
  }, [fetchDateData, selectedDate]);

  // Calculations for stats
  const totalCount = appointments.length;
  const pendingCount = appointments.filter(a => a.status === 'scheduled').length;
  const confirmedCount = appointments.filter(a => a.status === 'arrived' || a.status === 'completed').length;
  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

  // Group appointments by doctor for schedule list
  const doctorStats = doctorsList.map(doc => {
    const todayCount = appointments.filter(a => a.doctor?._id === doc._id).length;
    return {
      ...doc,
      count: todayCount
    };
  }).filter(d => d.count > 0 || user.role === 'super_admin');

  // Chart distribution (Morning: 09:00-12:00, Midday: 12:00-14:00, Afternoon: 14:00-17:00, Evening: 17:00-20:00)
  const getSlotHour = (slotStr) => {
    if (!slotStr) return 9;
    const match = slotStr.match(/^(\d+):/);
    return match ? parseInt(match[1], 10) : 9;
  };

  const chartSlots = [
    { label: '9 AM - 12 PM', count: appointments.filter(a => { const h = getSlotHour(a.slot); return h >= 9 && h < 12; }).length },
    { label: '12 PM - 2 PM', count: appointments.filter(a => { const h = getSlotHour(a.slot); return h >= 12 && h < 14; }).length },
    { label: '2 PM - 5 PM', count: appointments.filter(a => { const h = getSlotHour(a.slot); return h >= 14 && h < 17; }).length },
    { label: '5 PM - 8 PM', count: appointments.filter(a => { const h = getSlotHour(a.slot); return h >= 17 && h < 20; }).length },
  ];
  const maxChartCount = Math.max(...chartSlots.map(c => c.count), 1);

  // Calendar Dynamic calculations
  const displayMonthYear = calDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  const daysArray = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArray.push({
      day: prevTotalDays - i,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    daysArray.push({
      day: i,
      isCurrentMonth: true,
      isToday: dStr === todayStr,
      isSelected: dStr === selectedDate,
      dateStr: dStr
    });
  }

  // Suffix padding
  const remaining = 42 - daysArray.length;
  for (let i = 1; i <= remaining; i++) {
    daysArray.push({
      day: i,
      isCurrentMonth: false
    });
  }

  const handlePrevMonth = () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1));
  };

  const handleResetToday = () => {
    setCalDate(new Date());
    setSelectedDate(todayStr);
  };

  const handleDayClick = (item) => {
    if (!item.isCurrentMonth || !item.dateStr) return;
    setSelectedDate(item.dateStr);
  };

  // Human-readable label for selected date
  const selectedDateLabel = selectedDate === todayStr
    ? "Today"
    : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">
        Welcome back, {user?.name}!
      </h2>
      <p className="text-text-secondary text-sm mb-8">
        {selectedDate === todayStr
          ? "Here's what's happening with your EMR workstation today."
          : <>Viewing EMR data for <span className="font-semibold text-primary">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>. <button onClick={handleResetToday} className="text-primary underline cursor-pointer bg-transparent border-none font-semibold">Back to Today</button></>}
      </p>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {/* Total */}
        <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-150">
          <p className="text-xs font-bold text-sky-800 uppercase tracking-wider">Total Appointments</p>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-heading font-bold text-sky-950">{totalCount}</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-150">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Arrivals</p>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-heading font-bold text-amber-950">{pendingCount}</span>
          </div>
        </div>

        {/* Confirmed / Completed */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-150">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Confirmed & Done</p>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-heading font-bold text-emerald-950">{confirmedCount}</span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-150">
          <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Cancelled Visits</p>
          <div className="flex items-baseline gap-2 mt-3">
            <span className="text-4xl font-heading font-bold text-rose-950">{cancelledCount}</span>
          </div>
        </div>
      </div>

      {/* Main Splits */}
      <div className="grid grid-cols-[1fr_320px] gap-8 items-start">
        {/* Left Side: Schedule Progress and Hourly Chart */}
        <div className="flex flex-col gap-6">
          {user.role === 'doctor' ? (
            /* My Appointments — personal list, not the clinic-wide roster */
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-md font-bold text-slate-800 mb-4">My {selectedDateLabel}'s Appointments</h3>
              {appointments.length === 0 ? (
                <p className="text-text-muted text-center text-sm py-4">You have no appointments scheduled for this date.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {appointments.map((app) => (
                    <div key={app._id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 font-bold text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-lg w-fit shrink-0">
                          <Clock size={12} />
                          {app.slot}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{app.patient?.name || 'Unknown Patient'}</p>
                          <p className="text-xs text-slate-400 line-clamp-1 max-w-[280px]">{app.purpose}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        app.status === 'scheduled' ? 'bg-sky-50 text-sky-700' :
                        app.status === 'arrived' ? 'bg-amber-50 text-amber-700' :
                        app.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {app.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Today's Schedule doctors — clinic-wide roster (admin/receptionist) */
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="text-md font-bold text-slate-800 mb-4">{selectedDateLabel}'s Doctor Workloads</h3>
              {doctorStats.filter(doc => doc.count > 0).length === 0 ? (
                <p className="text-text-muted text-center text-sm py-4">No appointments scheduled for today.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {Object.entries(
                    doctorStats
                      .filter(doc => doc.count > 0)
                      .reduce((groups, doc) => {
                      const dept = doc.department || 'General';
                      if (!groups[dept]) groups[dept] = [];
                      groups[dept].push(doc);
                      return groups;
                    }, {})
                  ).map(([dept, doctors]) => (
                    <div key={dept}>
                      {/* Department Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-pink-700 bg-pink-100 border border-pink-200 px-3 py-1 rounded-full">
                          {dept}
                        </span>
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[9px] text-slate-400 font-medium">{doctors.length} doctor{doctors.length !== 1 ? 's' : ''}</span>
                      </div>
                      {/* Doctor Rows */}
                      <div className="flex flex-col gap-1">
                        {doctors.map((doc) => (
                          <div key={doc._id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/60 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-100 flex items-center justify-center shrink-0 shadow-sm bg-white">
                                {doc.avatar ? (
                                  <img src={doc.avatar} alt={doc.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                    <User size={16} className="text-white" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-slate-800">{doc.name}</p>
                                <p className="text-xs text-slate-400">{doc.department}</p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              doc.count > 0 ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {doc.count} patient{doc.count !== 1 ? 's' : ''} today
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CSS-native bar chart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-md font-bold text-slate-800 mb-6">{user.role === 'doctor' ? 'Your Booking Load Distribution' : 'Clinic Booking Load Distribution'}</h3>
            <div className="flex items-end justify-around h-48 pt-4 border-b border-slate-100">
              {chartSlots.map((c, idx) => {
                const heightPct = (c.count / maxChartCount) * 100;
                return (
                  <div key={idx} className="flex flex-col items-center gap-3 w-20 group">
                    <div className="w-full flex justify-center relative">
                      {/* Tooltip on hover */}
                      <span className="absolute -top-7 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow transition-all duration-100">
                        {c.count} app{c.count !== 1 ? 's' : ''}
                      </span>
                      {/* Animated Column Bar */}
                      <div 
                        style={{ height: `${Math.max(heightPct, 6)}%` }} 
                        className="w-10 rounded-t-lg bg-gradient-to-t from-primary/80 to-secondary/90 shadow-md group-hover:opacity-95 transition-all duration-300"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{c.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Calendar & Quick Actions */}
        <div className="flex flex-col gap-6">
          {/* Dynamic Monthly Calendar Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{displayMonthYear}</span>
              <div className="flex items-center gap-1">
                <button 
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer text-xs font-bold"
                  title="Previous Month"
                >
                  &lt;
                </button>
                <button 
                  type="button"
                  onClick={handleResetToday}
                  className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-200 transition cursor-pointer"
                >
                  Today
                </button>
                <button 
                  type="button"
                  onClick={handleNextMonth}
                  className="w-6 h-6 flex items-center justify-center rounded bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer text-xs font-bold"
                  title="Next Month"
                >
                  &gt;
                </button>
              </div>
            </div>
            
            {/* Weekdays */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {weekdays.map(d => (
                <span key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysArray.map((item, idx) => {
                return (
                  <div
                    key={idx}
                    onClick={() => handleDayClick(item)}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-semibold select-none transition-all duration-100 ${
                      item.isSelected && item.isCurrentMonth
                        ? 'bg-secondary text-white shadow-md ring-2 ring-secondary/30'
                        : item.isToday
                        ? 'bg-primary text-white shadow-md'
                        : !item.isCurrentMonth
                        ? 'text-slate-200 font-light cursor-default'
                        : 'text-slate-600 hover:bg-primary/10 hover:text-primary cursor-pointer'
                    }`}
                    title={item.isCurrentMonth ? item.dateStr : ''}
                  >
                    {item.day}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Quick Workstation Actions</h3>
            <div className="flex flex-col gap-2.5">
              {user.role === 'super_admin' && (
                <>
                  <button 
                    onClick={() => setActiveTab('staff')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users size={15} className="text-secondary" />
                      <span>Manage Staff Registry</span>
                    </div>
                    <span>→</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('schedules')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} className="text-primary" />
                      <span>Configure Shifts</span>
                    </div>
                    <span>→</span>
                  </button>
                </>
              )}

              {user.role === 'receptionist' && (
                <>
                  <button 
                    onClick={() => setActiveTab('scheduler')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <PlusCircle size={15} className="text-secondary" />
                      <span>Book New Appointment</span>
                    </div>
                    <span>→</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('appointments')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <ClipboardList size={15} className="text-primary" />
                      <span>Today's Arrival Board</span>
                    </div>
                    <span>→</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('search_patients')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Search size={15} className="text-teal-600" />
                      <span>Search Patient Records</span>
                    </div>
                    <span>→</span>
                  </button>
                </>
              )}

              {user.role === 'doctor' && (
                <button 
                  onClick={() => setActiveTab('doctor_appointments')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 text-slate-700 font-semibold text-xs text-left hover:bg-slate-50 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <ClipboardList size={15} className="text-primary" />
                    <span>My Clinical Worklist</span>
                  </div>
                  <span>→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
