import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../../services/apiClient';
import { getTodayDateStr } from '../../../utils/date';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const blocksToSnapshot = (blocks) =>
  blocks.map(({ id, name, startTime, endTime, type, enabled }) => ({ id, name, startTime, endTime, type, enabled }));

const mergeConsecutive = (arr) => {
  if (!arr.length) return [];
  const sorted = [...arr].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].startTime <= last.endTime) {
      if (sorted[i].endTime > last.endTime) last.endTime = sorted[i].endTime;
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
};

const timeToMins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minsToTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const defaultBlocks = () => [
  { id: 'morning', name: 'Morning Session', startTime: '09:00', endTime: '12:00', type: 'session', enabled: true },
  { id: 'lunch',   name: 'Lunch Break',     startTime: '12:00', endTime: '13:00', type: 'break',   enabled: true },
  { id: 'evening', name: 'Evening Session', startTime: '13:00', endTime: '17:00', type: 'session', enabled: true },
];

const scheduleToBlocks = (sched) => {
  const sess = mergeConsecutive(sched.sessions || []);
  const brks = mergeConsecutive(sched.breakTimings || []);
  const morningSession = sess.find(s => parseInt(s.startTime, 10) < 12);
  const eveningSession = sess.find(s => parseInt(s.startTime, 10) >= 12);
  const lunchBreak = brks[0];
  return [
    { id: 'morning', name: 'Morning Session', type: 'session', startTime: morningSession?.startTime || '09:00', endTime: morningSession?.endTime || '12:00', enabled: !!morningSession },
    { id: 'lunch',   name: 'Lunch Break',     type: 'break',   startTime: lunchBreak?.startTime    || '12:00', endTime: lunchBreak?.endTime    || '13:00', enabled: !!lunchBreak },
    { id: 'evening', name: 'Evening Session', type: 'session', startTime: eveningSession?.startTime || '13:00', endTime: eveningSession?.endTime || '17:00', enabled: !!eveningSession },
  ];
};

const SuperAdminScheduleView = () => {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [timeBlocks, setTimeBlocks] = useState(defaultBlocks);
  const [slotDuration, setSlotDuration] = useState(15);
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);

  const [hasOverride, setHasOverride] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(null);

  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);

  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('all');

  const selectedDocObj = useMemo(() => doctors.find(d => d._id === selectedDoc), [doctors, selectedDoc]);

  const doctorDeptObj = useMemo(() => {
    if (!selectedDocObj || !departments.length) return null;
    return departments.find(d => d.name === selectedDocObj.department);
  }, [selectedDocObj, departments]);

  const defaultWorkingDays = useMemo(() => {
    return doctorDeptObj?.workingDays || [1, 2, 3, 4, 5];
  }, [doctorDeptObj]);

  const handleDayToggle = (day) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const [listLoading, setListLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [loading, setLoading] = useState(''); // 'override' | 'default' | 'reset'
  const [err, setErr] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!showSuccessModal) return;
    const timer = setTimeout(() => setShowSuccessModal(false), 1000);
    return () => clearTimeout(timer);
  }, [showSuccessModal]);

  // Cache default schedule per doctor so date changes don't re-fetch default
  const defaultCacheRef = useRef({});
  // Cache override lookups so revisiting a doctor/date shows instantly.
  const overrideCacheRef = useRef({});

  const applyResolved = (defData, overrideEntry, resolvedWorkingDays) => {
    if (overrideEntry.exists) {
      setSlotDuration(overrideEntry.slotDuration);
      setTimeBlocks(overrideEntry.blocks.map(b => ({ ...b })));
      setHasOverride(true);
      setWorkingDays(resolvedWorkingDays);
      setSavedSnapshot({ slotDuration: overrideEntry.slotDuration, timeBlocks: blocksToSnapshot(overrideEntry.blocks), workingDays: resolvedWorkingDays });
    } else {
      setSlotDuration(defData.slotDuration);
      setTimeBlocks(defData.blocks.map(b => ({ ...b })));
      setHasOverride(false);
      setWorkingDays(resolvedWorkingDays);
      setSavedSnapshot({ slotDuration: defData.slotDuration, timeBlocks: blocksToSnapshot(defData.blocks), workingDays: resolvedWorkingDays });
    }
  };

  const fetchDoctors = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.get('/doctors');
      setDoctors(res.data.data);
    } catch (e) {
      console.error('Failed to fetch doctors:', e.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data.data);
    } catch (e) {
      console.error('Failed to fetch departments:', e.message);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
  }, [fetchDoctors, fetchDepartments]);

  // Refresh the department list when departments change elsewhere in the app.
  useEffect(() => {
    window.addEventListener('departments_changed', fetchDepartments);
    return () => window.removeEventListener('departments_changed', fetchDepartments);
  }, [fetchDepartments]);

  // Only show doctors whose department is still active (not blocked).
  const activeDoctors = useMemo(() => {
    const activeDeptNames = new Set(departments.map(d => d.name));
    return doctors.filter(d => activeDeptNames.has(d.department));
  }, [doctors, departments]);

  const filteredDoctors = useMemo(() =>
    selectedDeptFilter === 'all'
      ? activeDoctors
      : activeDoctors.filter(d => d.department === selectedDeptFilter),
    [activeDoctors, selectedDeptFilter]
  );

  useEffect(() => {
    if (filteredDoctors.length === 0) { setSelectedDoc(''); return; }
    const stillExists = filteredDoctors.some(d => d._id === selectedDoc);
    if (!stillExists) setSelectedDoc(filteredDoctors[0]._id);
  }, [filteredDoctors]);

  // Fetch default + override whenever doctor or date changes
  useEffect(() => {
    if (!selectedDoc) { setSavedSnapshot(null); return; }
    setErr('');

    const cacheKey = `${selectedDoc}::${selectedDate}`;
    const cachedDefault = defaultCacheRef.current[selectedDoc];
    const cachedOverride = overrideCacheRef.current[cacheKey];

    // If both are already cached, show them right away without a network call.
    if (cachedDefault && cachedOverride) {
      const resolvedWorkingDays = (cachedDefault.workingDays && cachedDefault.workingDays.length > 0)
        ? cachedDefault.workingDays
        : defaultWorkingDays;
      applyResolved(cachedDefault, cachedOverride, resolvedWorkingDays);
      setScheduleLoading(false);
      return;
    }

    const controller = new AbortController();
    setScheduleLoading(true);

    const loadAll = async () => {
      try {
        const needsDefault = !cachedDefault;

        // Fetch the missing pieces at the same time to save loading time.
        const [defResult, ovResult] = await Promise.allSettled([
          needsDefault
            ? api.get(`/doctors/${selectedDoc}/schedule`, { signal: controller.signal })
            : Promise.resolve(null),
          api.get(`/doctors/${selectedDoc}/schedule/override?date=${selectedDate}`, { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        if (needsDefault) {
          if (defResult.status === 'fulfilled') {
            const sched = defResult.value.data.data;
            defaultCacheRef.current[selectedDoc] = {
              slotDuration: sched.slotDuration || 15,
              blocks: scheduleToBlocks(sched),
              workingDays: sched.workingDays
            };
          } else {
            const e = defResult.reason;
            if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
            defaultCacheRef.current[selectedDoc] = { slotDuration: 15, blocks: defaultBlocks(), workingDays: undefined };
          }
        }
        const defData = defaultCacheRef.current[selectedDoc];
        const resolvedWorkingDays = (defData.workingDays && defData.workingDays.length > 0)
          ? defData.workingDays
          : defaultWorkingDays;

        let overrideEntry;
        if (ovResult.status === 'fulfilled') {
          const ov = ovResult.value.data.data;
          overrideEntry = { exists: true, slotDuration: ov.slotDuration || defData.slotDuration, blocks: scheduleToBlocks(ov) };
        } else {
          const e = ovResult.reason;
          if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
          overrideEntry = { exists: false };
        }
        overrideCacheRef.current[cacheKey] = overrideEntry;
        applyResolved(defData, overrideEntry, resolvedWorkingDays);
      } finally {
        if (!controller.signal.aborted) setScheduleLoading(false);
      }
    };

    loadAll();
    return () => controller.abort();
  }, [selectedDoc, selectedDate, defaultWorkingDays]);

  const updateBlock = (id, field, value) =>
    setTimeBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));

  const toggleBlock = (id) =>
    setTimeBlocks(prev => {
      const target = prev.find(b => b.id === id);
      const newEnabled = !target.enabled;
      return prev.map(b => {
        if (b.id === id) return { ...b, enabled: newEnabled };
        // Turning off the Evening Session also turns off the Lunch Break.
        if (id === 'evening' && b.id === 'lunch') return { ...b, enabled: newEnabled };
        return b;
      });
    });

  const buildPayload = () => {
    const sessions = timeBlocks.filter(b => b.type === 'session' && b.enabled).map(({ startTime, endTime }) => ({ startTime, endTime }));
    const breakTimings = timeBlocks.filter(b => b.type === 'break' && b.enabled).map(({ startTime, endTime }) => ({ startTime, endTime }));
    return { sessions, breakTimings, slotDuration: parseInt(slotDuration, 10) };
  };

  // Check that no enabled blocks have bad or overlapping times.
  const validateBlocks = () => {
    const enabled = timeBlocks.filter(b => b.enabled);
    for (const b of enabled) {
      if (timeToMins(b.startTime) >= timeToMins(b.endTime)) {
        return `"${b.name || 'Untitled block'}" needs an end time later than its start time.`;
      }
    }
    for (let i = 0; i < enabled.length; i++) {
      for (let j = i + 1; j < enabled.length; j++) {
        const a = enabled[i];
        const c = enabled[j];
        const aStart = timeToMins(a.startTime);
        const aEnd = timeToMins(a.endTime);
        const cStart = timeToMins(c.startTime);
        const cEnd = timeToMins(c.endTime);
        if (aStart < cEnd && cStart < aEnd) {
          return `"${a.name}" and "${c.name}" are set to the same time. Please change one of them so they don't clash.`;
        }
      }
    }
    return null;
  };

  const handleSaveOverride = async () => {
    if (!selectedDoc) return;
    const { sessions, breakTimings, slotDuration: dur } = buildPayload();
    if (sessions.length === 0) { setErr('Please enable at least one session block.'); return; }
    const validationErr = validateBlocks();
    if (validationErr) { setErr(validationErr); return; }
    setLoading('override');
    setErr('');
    try {
      await api.put(`/doctors/${selectedDoc}/schedule/override`, { date: selectedDate, sessions, slotDuration: dur, breakTimings });
      overrideCacheRef.current[`${selectedDoc}::${selectedDate}`] = { exists: true, slotDuration: dur, blocks: timeBlocks.map(b => ({ ...b })) };
      setHasOverride(true);
      setSavedSnapshot({ slotDuration: dur, timeBlocks: blocksToSnapshot(timeBlocks), workingDays: [...workingDays] });
      setSuccessMsg(`Schedule saved for ${formattedDate} only.`);
      setShowSuccessModal(true);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save override');
    } finally {
      setLoading('');
    }
  };

  const handleSaveDefault = async () => {
    if (!selectedDoc) return;
    const { sessions, breakTimings, slotDuration: dur } = buildPayload();
    if (sessions.length === 0) { setErr('Please enable at least one session block.'); return; }
    const validationErr = validateBlocks();
    if (validationErr) { setErr(validationErr); return; }
    setLoading('default');
    setErr('');
    try {
      await api.put(`/doctors/${selectedDoc}/schedule`, { sessions, slotDuration: dur, breakTimings, workingDays });
      // Update cache with new default
      defaultCacheRef.current[selectedDoc] = { slotDuration: dur, blocks: timeBlocks.map(b => ({ ...b })), workingDays: [...workingDays] };
      if (!hasOverride) {
        setSavedSnapshot({ slotDuration: dur, timeBlocks: blocksToSnapshot(timeBlocks), workingDays: [...workingDays] });
      }
      setSuccessMsg('Default schedule updated. All dates without an exception will use this schedule.');
      setShowSuccessModal(true);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to update default schedule');
    } finally {
      setLoading('');
    }
  };

  const handleCancel = () => {
    if (!savedSnapshot) return;
    setSlotDuration(savedSnapshot.slotDuration);
    setTimeBlocks(savedSnapshot.timeBlocks.map(b => ({ ...b })));
    setWorkingDays([...savedSnapshot.workingDays]);
    setErr('');
  };

  const handleResetToDefault = async () => {
    if (!selectedDoc || !hasOverride) return;
    setLoading('reset');
    setErr('');
    try {
      await api.delete(`/doctors/${selectedDoc}/schedule/override?date=${selectedDate}`);
      overrideCacheRef.current[`${selectedDoc}::${selectedDate}`] = { exists: false };
      const defData = defaultCacheRef.current[selectedDoc];
      if (defData) {
        setSlotDuration(defData.slotDuration);
        setTimeBlocks(defData.blocks.map(b => ({ ...b })));
        const resolvedWorkingDays = (defData.workingDays && defData.workingDays.length > 0)
          ? defData.workingDays
          : defaultWorkingDays;
        setWorkingDays(resolvedWorkingDays);
        setSavedSnapshot({ slotDuration: defData.slotDuration, timeBlocks: blocksToSnapshot(defData.blocks), workingDays: resolvedWorkingDays });
      }
      setHasOverride(false);
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to reset override');
    } finally {
      setLoading('');
    }
  };

  const isDirty = savedSnapshot && (
    String(slotDuration) !== String(savedSnapshot.slotDuration) ||
    JSON.stringify(blocksToSnapshot(timeBlocks)) !== JSON.stringify(savedSnapshot.timeBlocks) ||
    JSON.stringify(workingDays) !== JSON.stringify(savedSnapshot.workingDays)
  );

  // Re-check for errors every time the blocks change, not just on save.
  const blockValidationErr = useMemo(() => validateBlocks(), [timeBlocks]);

  const dayOfWeek = useMemo(() => {
    if (!selectedDate) return null;
    return new Date(selectedDate + 'T00:00:00').getDay();
  }, [selectedDate]);

  const dateAvailability = useMemo(() => {
    if (!selectedDate || !selectedDoc || scheduleLoading || dayOfWeek === null) return null;

    if (!hasOverride && !workingDays.includes(dayOfWeek)) {
      return { isWorking: false, slots: [], slotCount: 0, reason: 'not_working_day' };
    }

    const sessions = timeBlocks.filter(b => b.type === 'session' && b.enabled);
    const breaks = timeBlocks.filter(b => b.type === 'break' && b.enabled);
    if (sessions.length === 0) return { isWorking: false, slots: [], slotCount: 0, reason: 'no_sessions' };

    const dur = parseInt(slotDuration, 10) || 15;
    const slots = [];
    for (const sess of sessions) {
      let cur = timeToMins(sess.startTime);
      const end = timeToMins(sess.endTime);
      while (cur + dur <= end) {
        const slotEnd = cur + dur;
        const blocked = breaks.some(brk => cur < timeToMins(brk.endTime) && slotEnd > timeToMins(brk.startTime));
        if (!blocked) slots.push(minsToTime(cur));
        cur += dur;
      }
    }
    return { isWorking: true, slots, slotCount: slots.length };
  }, [selectedDate, timeBlocks, slotDuration, selectedDoc, scheduleLoading, dayOfWeek, workingDays, hasOverride]);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return '';
    return new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Manage Doctor Schedules</h2>
      <p className="text-text-secondary text-sm mb-8">Configure daily sessions and slot duration. Set exceptions for specific dates as needed.</p>

      {/* Filter toolbar */}
      {!listLoading && doctors.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-6 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Filter by Department</label>
            <select
              className="bg-white border border-slate-200 rounded-xl px-4 h-11 outline-none text-sm text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 cursor-pointer shadow-sm min-w-[200px]"
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Doctor</label>
            <select
              className="bg-white border border-slate-200 rounded-xl px-4 h-11 outline-none text-sm text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 cursor-pointer shadow-sm min-w-[220px]"
              value={selectedDoc}
              onChange={(e) => setSelectedDoc(e.target.value)}
            >
              {filteredDoctors.length === 0 && <option value="" disabled>No doctors in this department</option>}
              {filteredDoctors.map(d => (
                <option key={d._id} value={d._id}>{d.name} ({d.department})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Check Date</label>
            <input
              type="date"
              value={selectedDate}
              min={getTodayDateStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 h-11 outline-none text-sm text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 cursor-pointer shadow-sm"
            />
          </div>
        </div>
      )}

      {listLoading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 w-full shadow-sm animate-pulse flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl px-8 py-14 text-center shadow-sm">
          <p className="text-text-muted text-sm">No doctors found. Create a doctor first under "Manage Doctors".</p>
        </div>
      ) : filteredDoctors.length === 0 || !selectedDoc ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl px-8 py-14 text-center shadow-sm">
          <p className="text-slate-400 text-sm font-medium">No doctors in this department.</p>
          <p className="text-slate-300 text-xs mt-1">Select a different department or add a doctor to this one.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 w-full shadow-sm relative">
          {scheduleLoading && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
              <span className="text-xs font-semibold text-slate-400 tracking-wide">Loading schedule...</span>
            </div>
          )}

          {err && (
            <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm mb-6 text-center">
              {err}
            </div>
          )}

          {/* Doctor header */}
          {selectedDocObj && (
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center shrink-0 shadow-sm bg-white">
                {selectedDocObj.avatar ? (
                  <img src={selectedDocObj.avatar} alt={selectedDocObj.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                    <span className="text-white font-bold">{selectedDocObj.name[0] || 'D'}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{selectedDocObj.name}</p>
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md mt-1 inline-block">
                  {selectedDocObj.department}
                </span>
              </div>
              {/* Exception / Default badge */}
              {hasOverride ? (
                <span className="text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-2.5 py-1 rounded-lg shrink-0">
                  Exception · {formattedDate}
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
                  Default Schedule
                </span>
              )}
            </div>
          )}

          {/* Date Availability Card */}
          {dateAvailability && (
            <div className={`mb-6 rounded-xl px-5 py-4 border ${
              dateAvailability.isWorking ? 'bg-emerald-50/70 border-emerald-200/80' : 'bg-rose-50/70 border-rose-200/80'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  dateAvailability.isWorking ? 'bg-emerald-100' : 'bg-rose-100'
                }`}>
                  {dateAvailability.isWorking ? (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wider ${dateAvailability.isWorking ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {dateAvailability.isWorking ? 'Available' : 'Unavailable'}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-slate-600">{formattedDate}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className={`text-xs font-semibold ${dateAvailability.isWorking ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {dateAvailability.isWorking
                        ? `${dateAvailability.slotCount} slot${dateAvailability.slotCount !== 1 ? 's' : ''}`
                        : dateAvailability.reason === 'not_working_day'
                          ? 'Doctor does not work on this day of the week'
                          : 'No active sessions configured'}
                    </span>
                  </div>
                  {dateAvailability.isWorking && dateAvailability.slots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {dateAvailability.slots.slice(0, 12).map((slot) => (
                        <span key={slot} className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                          {slot}
                        </span>
                      ))}
                      {dateAvailability.slots.length > 12 && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-md">
                          +{dateAvailability.slots.length - 12} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Duration & Default Working Days */}
          <div className="flex gap-6 mb-8 flex-wrap">
            <div className="min-w-[150px] flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Slot Duration (Minutes)</label>
              <select
                className="bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
                value={slotDuration}
                onChange={(e) => setSlotDuration(e.target.value)}
              >
                <option value={10}>10 Min</option>
                <option value={15}>15 Min</option>
                <option value={20}>20 Min</option>
                <option value={30}>30 Min</option>
                <option value={45}>45 Min</option>
                <option value={60}>60 Min</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Default Working Days</label>
              <div className="flex gap-1.5 flex-wrap">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDayToggle(idx)}
                    className={`w-10 h-9 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                      workingDays.includes(idx)
                        ? 'bg-primary text-white border-primary shadow-[0_2px_8px_rgba(13,105,93,0.15)]'
                        : 'bg-white text-text-secondary border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Daily Schedule — fixed 3 blocks */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Daily Schedule</label>

            {timeBlocks.map((block) => (
              <div
                key={block.id}
                className={`flex flex-wrap items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 rounded-2xl border transition-all duration-200 ${
                  block.enabled
                    ? block.type === 'session'
                      ? 'bg-emerald-50/60 border-emerald-200/80'
                      : 'bg-amber-50/60 border-amber-200/80'
                    : 'bg-slate-50 border-slate-200 opacity-50'
                }`}
              >
                <div className={`w-1 self-stretch rounded-full shrink-0 ${
                  block.enabled
                    ? block.type === 'session' ? 'bg-emerald-400' : 'bg-amber-400'
                    : 'bg-slate-300'
                }`} />

                <div className="w-full sm:w-auto sm:flex-1 min-w-0">
                  <input
                    type="text"
                    value={block.name}
                    onChange={(e) => updateBlock(block.id, 'name', e.target.value)}
                    disabled={!block.enabled}
                    className={`text-sm font-bold bg-transparent border-none outline-none w-full mb-2 placeholder:font-normal disabled:cursor-not-allowed ${
                      block.enabled
                        ? block.type === 'session' ? 'text-emerald-800' : 'text-amber-800'
                        : 'text-slate-400'
                    }`}
                    placeholder="Block name..."
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={block.startTime}
                      onChange={(e) => updateBlock(block.id, 'startTime', e.target.value)}
                      disabled={!block.enabled}
                      className={`bg-white/80 border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                        block.enabled && block.type === 'session' ? 'border-emerald-200/60 focus:border-emerald-300 focus:ring-emerald-100'
                          : block.enabled && block.type === 'break' ? 'border-amber-200/60 focus:border-amber-300 focus:ring-amber-100'
                          : 'border-slate-200'
                      }`}
                    />
                    <span className={`text-xs font-bold ${block.enabled ? block.type === 'session' ? 'text-emerald-400' : 'text-amber-400' : 'text-slate-300'}`}>–</span>
                    <input
                      type="time"
                      value={block.endTime}
                      onChange={(e) => updateBlock(block.id, 'endTime', e.target.value)}
                      disabled={!block.enabled}
                      className={`bg-white/80 border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:ring-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                        block.enabled && block.type === 'session' ? 'border-emerald-200/60 focus:border-emerald-300 focus:ring-emerald-100'
                          : block.enabled && block.type === 'break' ? 'border-amber-200/60 focus:border-amber-300 focus:ring-amber-100'
                          : 'border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${
                  block.enabled
                    ? block.type === 'session' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {block.enabled ? (block.type === 'session' ? 'Session' : 'Break') : 'Blocked'}
                </span>

                {block.id !== 'lunch' && (
                  <button
                    type="button"
                    onClick={() => toggleBlock(block.id)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150 shrink-0 border ${
                      block.enabled
                        ? 'bg-white border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500'
                        : 'bg-white border-slate-200 text-slate-400 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600'
                    }`}
                  >
                    {block.enabled ? 'Block' : 'Enable'}
                  </button>
                )}
              </div>
            ))}

            {blockValidationErr && (
              <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-xs text-center mt-1">
                {blockValidationErr}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-wrap gap-3 items-center">
            {isDirty && (
              <>
                {/* Save for this date only (override) */}
                <button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={!!loading || !!blockValidationErr}
                  title={blockValidationErr || undefined}
                  className="px-6 h-11 bg-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(22,163,74,0.2)] hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-[0_0_20px_rgba(22,163,74,0.2)] active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm animate-[fadeIn_0.2s_ease-out]"
                >
                  {loading === 'override'
                    ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    : `Save for ${formattedDate}`}
                </button>

                {/* Update the default schedule, hidden when viewing an exception date */}
                {!hasOverride && (
                  <button
                    type="button"
                    onClick={handleSaveDefault}
                    disabled={!!loading || !!blockValidationErr}
                    title={blockValidationErr || undefined}
                    className="px-6 h-11 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm animate-[fadeIn_0.2s_ease-out]"
                  >
                    {loading === 'default'
                      ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600" />
                      : 'Update Default'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={!!loading}
                  className="px-6 h-11 bg-white border border-slate-200 text-slate-500 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 active:translate-y-0 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm animate-[fadeIn_0.2s_ease-out]"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Reset to default — always visible when override exists for this date */}
            {hasOverride && (
              <button
                type="button"
                onClick={handleResetToDefault}
                disabled={!!loading}
                className="px-6 h-11 bg-rose-50 border border-rose-200 text-rose-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-all duration-200 cursor-pointer disabled:opacity-50 text-sm animate-[fadeIn_0.2s_ease-out]"
              >
                {loading === 'reset'
                  ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-rose-200 border-t-rose-600" />
                  : 'Reset to Default'}
              </button>
            )}
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          <div className="relative bg-white border border-slate-200/80 shadow-2xl w-full max-w-[380px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              aria-label="Close"
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-heading font-bold text-slate-800 mb-1">Schedule Updated</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">{successMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminScheduleView;
