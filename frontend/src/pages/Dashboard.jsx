import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { logoutUser } from '../store/slices/authSlice';
import { useSocket } from '../context/SocketContext';
import NotificationBell from '../components/common/NotificationBell';
import {
  Users,
  Calendar,
  ClipboardList,
  LogOut,
  FileText,
  AlertCircle,
  Stethoscope,
  User,
  LayoutGrid,
  Layers,
  Search,
  RefreshCw,
  Clock,
  Menu
} from 'lucide-react';

// Clock in the navbar, kept separate so it doesn't re-render the whole page
const NavbarClock = memo(() => {
  const [liveTime, setLiveTime] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date().toLocaleTimeString());

  const triggerRefresh = useCallback(() => {
    window.dispatchEvent(new Event('appointment_changed_ws'));
    setLastRefreshed(new Date().toLocaleTimeString());
    setCountdown(30);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      // Just count down by one each second
      setCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      triggerRefresh();
    }
  }, [countdown, triggerRefresh]);

  const dateStr = useMemo(
    () => liveTime.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    // Recompute only when the day changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveTime.toDateString()]
  );

  const timeStr = liveTime.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-2 lg:gap-4">
      <div className="hidden lg:flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Clock size={15} className="text-primary" />
        </div>
        <span className="text-sm font-semibold text-primary tabular-nums">{dateStr}</span>
        <span className="text-primary/40">·</span>
        <span className="text-sm font-bold text-primary tabular-nums">{timeStr}</span>
      </div>

      <div className="hidden lg:block w-px h-8 bg-slate-200 shrink-0" />

      <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 px-2 py-1.5 lg:px-4 lg:py-2 rounded-xl">
        <div className="hidden lg:flex lg:flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto Sync</span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-bold text-slate-700 tabular-nums">Next in {countdown}s</span>
          </div>
          <span className="text-[9px] text-slate-800 font-semibold tabular-nums">Last: {lastRefreshed}</span>
        </div>
        <button
          onClick={triggerRefresh}
          title="Sync Now"
          className="w-8 h-8 bg-slate-50 hover:bg-primary/5 border border-slate-200 hover:border-primary/20 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 shadow-sm"
        >
          <RefreshCw size={13} className="text-slate-500" />
        </button>
      </div>
    </div>
  );
});

import OverviewView from '../components/views/overview/OverviewView';
import StaffView from '../components/views/admin/StaffView';
import DoctorsView from '../components/views/admin/DoctorsView';
import DepartmentsView from '../components/views/admin/DepartmentsView';
import SchedulesView from '../components/views/admin/SchedulesView';
import AllAppointmentsView from '../components/views/appointments/AllAppointmentsView';
import AuditLogsView from '../components/views/admin/AuditLogsView';
import PlannerView from '../components/views/appointments/PlannerView';
import BookAppointmentView from '../components/views/appointments/BookAppointmentView';
import PatientRecordsView from '../components/views/patients/PatientRecordsView';
import DoctorWorklistView from '../components/views/consultation/DoctorWorklistView';
import MyProfileView from '../components/views/profile/MyProfileView';

// List of sidebar links, in the order they should appear
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, roles: ['super_admin', 'receptionist', 'doctor'] },
  // Super admin opens their profile from the navbar icon, so hide it from their sidebar
  { id: 'my_profile', label: 'My Profile', icon: User, roles: ['super_admin', 'receptionist', 'doctor'], hideFromSidebarForRoles: ['super_admin'] },

  { id: 'departments', label: 'Manage Departments', icon: Layers, roles: ['super_admin'], section: 'Configuration' },
  { id: 'doctors', label: 'Manage Doctors', title: 'Manage Clinic Doctors', icon: User, roles: ['super_admin'] },
  { id: 'schedules', label: 'Doctor Schedules', icon: Calendar, roles: ['super_admin'] },
  { id: 'staff', label: 'Manage Staff', icon: Users, roles: ['super_admin'] },

  { id: 'scheduler', label: 'Book Appointment', icon: Calendar, roles: ['super_admin', 'receptionist'], section: 'Operations' },
  { id: 'appointments', label: 'Daily Planner', icon: ClipboardList, roles: ['super_admin', 'receptionist'] },
  { id: 'search_patients', label: 'Search Patients', icon: Search, roles: ['super_admin', 'receptionist'] },
  { id: 'all_appointments', label: 'All Appointments', icon: ClipboardList, roles: ['super_admin'] },
  { id: 'doctor_appointments', label: 'My Consultations', icon: ClipboardList, roles: ['doctor'] },

  { id: 'audit_logs', label: 'System Audit Logs', icon: FileText, roles: ['super_admin'], section: 'Reports' },
];

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const { user } = useSelector((state) => state.auth);
  const socket = useSocket();

  // The active tab comes from the URL, so refreshing the page keeps it
  const activeTab = tabParam || 'overview';

  // Switch tabs by changing the URL
  const setActiveTab = useCallback((tabId) => {
    navigate(`/${tabId}`);
  }, [navigate]);

  const [realtimeNotification, setRealtimeNotification] = useState(null);

  // Send the user back to overview if their current tab isn't allowed
  useEffect(() => {
    if (!user?.role || !tabParam) return;
    const isValidTab = NAV_ITEMS.some((item) => item.id === tabParam && item.roles.includes(user.role));
    if (!isValidTab) {
      navigate('/overview', { replace: true });
    }
  }, [user?.role, tabParam, navigate]);


  // Listen for live appointment updates from the server
  useEffect(() => {
    if (!socket) return;

    const handleAppointmentChange = (changeData) => {
      // Tell other components to refresh their appointment data
      const customEvent = new Event('appointment_changed_ws');
      window.dispatchEvent(customEvent);

      // Build the popup message for this appointment change
      const appt = changeData.data || {};
      let message = `Appointment slot ${appt.slot} status updated to: ${appt.status}`;
      if (changeData.type === 'created') {
        message = `New appointment booked for slot: ${appt.slot}`;
      } else if (changeData.type === 'cancelled') {
        message = `Appointment at ${appt.slot} was cancelled!`;
      }

      setRealtimeNotification({
        msg: message,
        type: appt.status
      });

      // Hide the popup after a few seconds
      setTimeout(() => {
        setRealtimeNotification(null);
      }, 6000);
    };

    socket.on('appointment_change', handleAppointmentChange);

    const handleScheduleChange = () => {
      // Tell the booking view to refresh its available slots
      window.dispatchEvent(new Event('schedule_changed_ws'));
    };
    socket.on('schedule_change', handleScheduleChange);

    const handleStaffChange = () => {
      // Tell the notification bell to refresh its count
      window.dispatchEvent(new Event('staff_changed_ws'));
    };
    socket.on('staff_change', handleStaffChange);

    return () => {
      socket.off('appointment_change', handleAppointmentChange);
      socket.off('schedule_change', handleScheduleChange);
      socket.off('staff_change', handleStaffChange);
    };
  }, [socket]);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    navigate('/login');
  };

  return (
    <div className="h-screen w-screen flex bg-bg-main overflow-hidden font-sans">
      {realtimeNotification && (
        <div
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md p-[12px_16px] sm:p-[12px_24px] rounded-xl text-white flex items-center gap-4 shadow-2xl animate-[fadeIn_0.25s_forwards]"
          style={{
            backgroundColor: realtimeNotification.type === 'cancelled' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'
          }}
        >
          <div className="flex items-center gap-[10px]">
            <AlertCircle size={18} />
            <span className="font-semibold">{realtimeNotification.msg}</span>
          </div>
          <button className="bg-transparent border-none text-white text-[20px] cursor-pointer font-bold ml-[10px]" onClick={() => setRealtimeNotification(null)}>×</button>
        </div>
      )}

      {/* Sidebar backdrop — mobile/tablet only, dismisses the drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar — off-canvas drawer below lg, permanent from lg up */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[280px] bg-[#0d695d] flex flex-col h-screen p-5 select-none shrink-0 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo */}
          <div className="flex items-center gap-2.5 pl-2 pb-3.5 mb-3.5 -mx-5 px-5 border-b border-white/10 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-md">
              <Stethoscope size={18} className="text-teal-300 animate-pulse" />
            </div>
            <span className="text-lg font-heading font-bold text-white tracking-wide">Adam Care</span>
          </div>

          <p className="text-[10px] font-bold text-teal-200/50 uppercase tracking-wider mb-2.5 pl-3 shrink-0">Navigation</p>

          <nav
            className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto pr-1 -mr-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
          >
            {NAV_ITEMS.filter(item => user?.role && item.roles.includes(user.role) && !(item.hideFromSidebarForRoles || []).includes(user.role)).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <React.Fragment key={item.id}>
                  {item.section && (
                    <p className="text-[9px] font-bold text-teal-200/40 uppercase tracking-wider mt-2.5 mb-1 pl-3 first:mt-0">
                      {item.section}
                    </p>
                  )}
                  <button
                    className={`flex items-center gap-3 p-2.5 px-3.5 rounded-xl border-none text-left cursor-pointer transition-all duration-150 text-[13px] font-semibold shrink-0 ${
                      isActive
                        ? 'bg-[#0a5249] text-white'
                        : 'bg-transparent text-teal-100/70 hover:text-white hover:bg-white/5'
                    }`}
                    onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  >
                    <Icon size={16} className={isActive ? 'text-teal-300' : 'text-teal-200/60'} />
                    <span>{item.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Profile Card / Exit block */}
        <div className="bg-[#0a5249] border border-teal-800/10 rounded-2xl p-3 flex items-center justify-between shadow-sm shrink-0 mt-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-teal-600/30 flex items-center justify-center shrink-0 border border-teal-500/20">
              <User size={16} className="text-teal-300" />
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-xs text-white truncate leading-snug">{user?.name}</p>
              <p className="text-[9px] text-teal-300/80 font-bold tracking-wider uppercase truncate mt-0.5">
                {user?.role.replace('_', ' ')}
                {user?.department ? ` | ${user.department}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="w-8 h-8 rounded-lg bg-transparent border-none text-teal-300 hover:text-white hover:bg-white/5 flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Right Content Area */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-[82px] bg-white border-b border-slate-200/60 shadow-sm px-4 md:px-8 flex items-center justify-between shrink-0 relative z-10">

          {/* Left — Hamburger (mobile/tablet) + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle navigation"
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-600 shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 leading-none truncate">
                {NAV_ITEMS.find(item => item.id === activeTab)?.title
                  || NAV_ITEMS.find(item => item.id === activeTab)?.label
                  || 'Dashboard'}
              </span>
            </div>
          </div>

          {/* Right — Clock + Auto Sync, then Notifications + Profile (super admin only) at the very end */}
          <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            <NavbarClock />
            {user?.role === 'super_admin' && (
              <>
                <div className="hidden lg:block w-px h-8 bg-slate-200 shrink-0" />
                <div className="flex items-center gap-2">
                  <NotificationBell />
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_profile')}
                    title="My Profile"
                    className={`w-9 h-9 rounded-lg border-none flex items-center justify-center cursor-pointer transition-all duration-150 ${
                      activeTab === 'my_profile'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-transparent hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <User size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Scrollable Workarea */}
        <main className="flex-grow p-4 md:p-8 overflow-y-auto bg-[#f4f6f8]">
          <div className="max-w-[1300px] mx-auto bg-white border border-slate-200/60 shadow-md p-4 md:p-8 rounded-2xl min-h-[500px]">
            {/* Keep every panel mounted — CSS hidden prevents remount/refetch on every tab switch */}
            <div className={activeTab === 'overview' ? '' : 'hidden'}><OverviewView user={user} setActiveTab={setActiveTab} /></div>
            <div className={activeTab === 'my_profile' ? '' : 'hidden'}><MyProfileView /></div>

            {user?.role === 'super_admin' && (
              <>
                <div className={activeTab === 'staff' ? '' : 'hidden'}><StaffView /></div>
                <div className={activeTab === 'doctors' ? '' : 'hidden'}><DoctorsView /></div>
                <div className={activeTab === 'departments' ? '' : 'hidden'}><DepartmentsView /></div>
                <div className={activeTab === 'schedules' ? '' : 'hidden'}><SchedulesView /></div>
                <div className={activeTab === 'all_appointments' ? '' : 'hidden'}><AllAppointmentsView /></div>
                <div className={activeTab === 'audit_logs' ? '' : 'hidden'}><AuditLogsView /></div>
              </>
            )}

            {(user?.role === 'receptionist' || user?.role === 'super_admin') && (
              <>
                <div className={activeTab === 'scheduler' ? '' : 'hidden'}><BookAppointmentView /></div>
                <div className={activeTab === 'appointments' ? '' : 'hidden'}><PlannerView /></div>
                <div className={activeTab === 'search_patients' ? '' : 'hidden'}><PatientRecordsView /></div>
              </>
            )}

            {user?.role === 'doctor' && (
              <div className={activeTab === 'doctor_appointments' ? '' : 'hidden'}><DoctorWorklistView /></div>
            )}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center z-[99999] p-4 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]">
          {loggingOut ? (
            <div className="bg-white border border-slate-200/80 shadow-2xl w-full max-w-[380px] p-8 rounded-2xl animate-[scaleIn_0.15s_ease-out] flex flex-col items-center text-center">
              <div className="relative w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Signing out...</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 shadow-2xl w-full max-w-[380px] p-6 rounded-2xl animate-[scaleIn_0.15s_ease-out] flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <LogOut size={24} className="text-slate-600" />
              </div>
              <h3 className="text-lg font-heading font-bold text-slate-800 mb-1">Sign Out of EMR?</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                You are about to end your current EMR session. Any unsaved changes may be lost.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-grow h-11 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Stay Logged In
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="flex-grow h-11 text-xs font-semibold text-white rounded-xl bg-slate-800 hover:bg-slate-900 shadow-md transition cursor-pointer"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
