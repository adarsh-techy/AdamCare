import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../../services/apiClient';

const PAGE_SIZE = 10;

// Dashboard's main content area (Dashboard.jsx's <main>) is the element that
// actually scrolls — the window/document never does, since the sidebar+header
// layout is a fixed-height flex box with overflow-y-auto on that <main>.
// Walk up from a ref inside this view to find whichever ancestor is really
// scrollable, so this works regardless of exactly how it's mounted.
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

const AuditLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [err, setErr] = useState('');
  const rootRef = useRef(null);

  // Guards against firing a second fetch while one is already in flight,
  // since scroll events fire far more often than we want to hit the API.
  const fetchingRef = useRef(false);

  const fetchLogs = useCallback(async (pageNum) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setErr('');
    try {
      const res = await api.get('/appointments/audit/logs', { params: { page: pageNum, limit: PAGE_SIZE } });
      setLogs((prev) => (pageNum === 1 ? res.data.data : [...prev, ...res.data.data]));
      setTotalLogs(res.data.meta?.total ?? res.data.data.length);
      setPage(pageNum);
    } catch (e) {
      console.error('Audit logs fetch failed:', e.response?.data?.message || e.message);
      setErr(e.response?.data?.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const hasMore = logs.length < totalLogs;

  // On-scroll pagination: load the next 10 once the user nears the bottom
  // of the actual scrolling container, instead of fetching everything upfront.
  useEffect(() => {
    const scrollEl = findScrollParent(rootRef.current);
    const isWindowScroll = scrollEl === document.scrollingElement || scrollEl === document.documentElement;

    const handleScroll = () => {
      if (fetchingRef.current || !hasMore) return;
      const scrolledToBottom = isWindowScroll
        ? window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200
        : scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 200;
      if (scrolledToBottom) {
        fetchLogs(page + 1);
      }
    };

    const target = isWindowScroll ? window : scrollEl;
    target.addEventListener('scroll', handleScroll);
    return () => target.removeEventListener('scroll', handleScroll);
  }, [fetchLogs, page, hasMore]);

  return (
    <div ref={rootRef} className="w-full animate-[fadeIn_0.2s_ease-out]">
      <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">Clinic Security Audit Trail</h2>
      <p className="text-text-secondary text-sm mb-8">Immutable log records tracking administrative logins, staff creation, appointments created, and notes modified.</p>

      {err && (
        <div className="bg-danger-bg text-danger border border-danger/15 p-3 rounded-lg text-sm mb-4 text-center">{err}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div></div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-text-secondary text-xs uppercase font-bold tracking-wider">
                <th className="pb-3 px-4">Timestamp</th>
                <th className="pb-3 px-4">Operator</th>
                <th className="pb-3 px-4">Role</th>
                <th className="pb-3 px-4">Action</th>
                <th className="pb-3 px-4">Modified Entity</th>
                <th className="pb-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-slate-100 hover:bg-slate-50/50 h-[60px] transition-colors duration-150">
                  <td className="px-4 text-xs text-text-secondary">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 font-semibold text-sm text-text-primary">{log.user?.name || 'System / Auto'}</td>
                  <td className="px-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">{log.role}</span></td>
                  <td className="px-4"><span className="font-bold text-xs text-secondary">{log.action}</span></td>
                  <td className="px-4 text-sm text-text-primary">{log.entity}</td>
                  <td className="px-4 text-xs font-mono text-text-muted max-w-[320px] truncate" title={JSON.stringify(log.details || {})}>
                    {JSON.stringify(log.details || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="text-text-muted text-center text-sm py-12">No logs recorded yet.</p>}

          {loadingMore && (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div>
            </div>
          )}

          {logs.length > 0 && (
            <p className="text-center text-[11px] font-semibold text-slate-400 py-4">
              {hasMore
                ? `Showing ${logs.length} of ${totalLogs} — scroll for more`
                : `Showing all ${totalLogs} log${totalLogs !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogsView;
