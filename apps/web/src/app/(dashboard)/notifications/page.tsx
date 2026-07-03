"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { notificationApi } from "@/lib/api/notification-api";

export default function NotificationsPage() {
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    notificationApi.list().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: string) {
    const item = items.find((n) => n.id === id);
    if (!item || item.isRead) return;
    setMarkingId(id);
    try {
      await notificationApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingId(null); }
  }

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Bell size={18} className="text-slate-400" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 h-5 min-w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="page-subtitle mt-1">In-app alerts — click unread to mark as read</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Bell size={18} className="text-slate-300" />
          </div>
          <p className="text-[13px] text-slate-400">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              role={n.isRead ? undefined : "button"}
              tabIndex={n.isRead ? undefined : 0}
              onClick={() => handleMarkRead(n.id)}
              onKeyDown={(e) => { if (!n.isRead && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleMarkRead(n.id); } }}
              className={`rounded-lg border p-4 transition-all duration-150 ${
                n.isRead
                  ? "border-slate-100 bg-white"
                  : "border-blue-100 bg-blue-50/40 cursor-pointer hover:bg-blue-50 hover:border-blue-200"
              } ${markingId === n.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                    n.isRead ? "bg-slate-100 text-slate-400" : "bg-blue-100 text-blue-600"
                  }`}>
                    {n.isRead ? <CheckCheck size={14} /> : <Bell size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[13px] font-semibold truncate ${n.isRead ? "text-slate-700" : "text-slate-900"}`}>
                      {n.title}
                    </p>
                    {n.body && <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={11} className="text-slate-300" />
                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400">{n.eventType}</span>
                    </div>
                  </div>
                </div>
                {!n.isRead && (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                    Unread
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
