"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Clock, Radio, Settings2, Trash2 } from "lucide-react";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import {
  notificationApi,
  subscribeNotificationStream,
  type NotificationChannel,
  type NotificationItem,
  type NotificationPreference,
} from "@/lib/api/notification-api";

const EVENT_TYPES = [
  "budget.overrun",
  "po.created",
  "invoice.approved",
  "invoice.issued",
  "project.created",
  "reorder.triggered",
  "requisition.created",
  "milestone.overdue",
  "milestone.achieved",
  "payroll.completed",
  "leave.status.changed",
  "employee.created",
] as const;

const CHANNELS: { id: NotificationChannel; label: string }[] = [
  { id: "IN_APP", label: "In-app" },
  { id: "EMAIL", label: "Email" },
  { id: "SMS", label: "SMS" },
];

function prefKey(eventType: string, channel: NotificationChannel) {
  return `${eventType}::${channel}`;
}

function isEnabled(
  prefs: NotificationPreference[],
  eventType: string,
  channel: NotificationChannel,
): boolean {
  const row = prefs.find((p) => p.eventType === eventType && p.channel === channel);
  return row?.isEnabled ?? true;
}

export default function NotificationsPage() {
  const { initialized, authenticated } = useKeycloak();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "error">("connecting");

  const loadList = useCallback(async () => {
    setListError(null);
    try {
      const data = await notificationApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrefs = useCallback(async () => {
    setPrefsError(null);
    setPrefsLoading(true);
    try {
      const data = await notificationApi.getPreferences();
      setPrefs(Array.isArray(data) ? data : []);
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "Failed to load preferences");
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized || !authenticated) return;
    loadList();
    loadPrefs();
  }, [initialized, authenticated, loadList, loadPrefs]);

  useEffect(() => {
    if (!initialized || !authenticated) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    setLiveStatus("connecting");

    (async () => {
      unsubscribe = await subscribeNotificationStream(
        (notification) => {
          if (cancelled) return;
          setLiveStatus("live");
          setItems((prev) => {
            if (prev.some((n) => n.id === notification.id)) return prev;
            return [{ ...notification, isRead: notification.isRead ?? false }, ...prev];
          });
        },
        () => {
          if (!cancelled) setLiveStatus("error");
        },
      );
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [initialized, authenticated]);

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
      setMarkingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification?")) return;
    setDeletingId(id);
    try {
      await notificationApi.remove(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTogglePref(
    eventType: string,
    channel: NotificationChannel,
    nextEnabled: boolean,
  ) {
    const key = prefKey(eventType, channel);
    setSavingKey(key);
    setPrefsError(null);
    try {
      const updated = await notificationApi.setPreference({
        eventType,
        channel,
        isEnabled: nextEnabled,
      });
      setPrefs((prev) => {
        const idx = prev.findIndex((p) => p.eventType === eventType && p.channel === channel);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [...prev, updated];
      });
    } catch (err) {
      setPrefsError(err instanceof Error ? err.message : "Failed to update preference");
    } finally {
      setSavingKey(null);
    }
  }

  const unreadCount = items.filter((n) => !n.isRead).length;
  const readCount = items.length - unreadCount;
  const filteredItems = items.filter((n) =>
    readFilter === "unread" ? !n.isRead : readFilter === "read" ? n.isRead : true,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Bell size={18} style={{color: '#6b7280'}} />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 h-5 min-w-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1.5" style={{background: '#1f5fa8'}}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="page-subtitle mt-1">In-app alerts — click unread to mark as read</p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border`}
          style={
            liveStatus === "live"
              ? {color: '#059669', background: '#ecfdf5', borderColor: '#a7f3d0'}
              : liveStatus === "error"
                ? {color: '#d97706', background: '#fffbeb', borderColor: '#fde68a'}
                : {color: '#6b7280', background: '#f4f6f8', borderColor: '#dfe3e8'}
          }
          title="Server-Sent Events connection"
        >
          <Radio size={12} />
          {liveStatus === "live" ? "Live" : liveStatus === "error" ? "Reconnecting" : "Connecting"}
        </div>
      </div>

      {/* Preferences */}
      <section className="bg-white rounded-lg border shadow-card overflow-hidden" style={{borderColor: '#dfe3e8'}}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{borderColor: '#dfe3e8'}}>
          <Settings2 size={14} style={{color: '#6b7280'}} />
          <h2 className="text-[13px] font-semibold" style={{color: '#2b2f36'}}>Channel preferences</h2>
          <span className="text-[11px] ml-auto" style={{color: '#6b7280'}}>
            Opt-out model — channels default to on
          </span>
        </div>

        {prefsError && (
          <div className="mx-4 mt-3 text-[12px] rounded-md px-3 py-2 border" style={{color: '#dc2626', background: '#fef2f2', borderColor: '#fca5a5'}}>
            {prefsError}
          </div>
        )}

        {prefsLoading ? (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{borderColor: '#dfe3e8', background: '#f4f6f8'}}>
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{color: '#6b7280'}}>
                    Event
                  </th>
                  {CHANNELS.map((ch) => (
                    <th
                      key={ch.id}
                      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-center"
                      style={{color: '#6b7280'}}
                    >
                      {ch.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENT_TYPES.map((eventType) => (
                  <tr key={eventType} className="border-b last:border-0" style={{borderColor: '#dfe3e8'}}>
                    <td className="px-4 py-2.5 text-[12px] font-mono" style={{color: '#2b2f36'}}>
                      {eventType}
                    </td>
                    {CHANNELS.map((ch) => {
                      const key = prefKey(eventType, ch.id);
                      const enabled = isEnabled(prefs, eventType, ch.id);
                      const saving = savingKey === key;
                      return (
                        <td key={ch.id} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${eventType} ${ch.label}`}
                            checked={enabled}
                            disabled={saving}
                            onChange={(e) => handleTogglePref(eventType, ch.id, e.target.checked)}
                            className="h-3.5 w-3.5 rounded cursor-pointer disabled:opacity-50"
                            style={{borderColor: '#dfe3e8'}}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* List */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{background: '#f4f6f8'}}>
        {(
          [
            { id: "all", label: "All", count: items.length },
            { id: "unread", label: "Unread", count: unreadCount },
            { id: "read", label: "Read", count: readCount },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setReadFilter(f.id)}
            className={`text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors`}
            style={readFilter === f.id ? {background: '#fff', color: '#2b2f36', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'} : {color: '#6b7280'}}
          >
            {f.label} <span style={{color: '#9ca3af'}}>{f.count}</span>
          </button>
        ))}
      </div>

      {listError && (
        <div className="text-[12px] rounded-md px-3 py-2 border" style={{color: '#dc2626', background: '#fef2f2', borderColor: '#fca5a5'}}>
          {listError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{background: '#f4f6f8'}} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-card px-6 py-14 text-center" style={{borderColor: '#dfe3e8'}}>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{background: '#f4f6f8'}}>
            <Bell size={18} style={{color: '#d1d5db'}} />
          </div>
          <p className="text-[13px]" style={{color: '#6b7280'}}>
            {items.length === 0
              ? "No notifications yet."
              : readFilter === "unread"
                ? "No unread notifications."
                : "No read notifications."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 transition-all duration-150 ${markingId === n.id || deletingId === n.id ? "opacity-50" : ""}`}
              style={n.isRead ? {borderColor: '#dfe3e8', background: '#fff'} : {borderColor: '#c7d2e0', background: '#f0f4f8'}}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  role={n.isRead ? undefined : "button"}
                  tabIndex={n.isRead ? undefined : 0}
                  onClick={() => handleMarkRead(n.id)}
                  onKeyDown={(e) => {
                    if (!n.isRead && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      handleMarkRead(n.id);
                    }
                  }}
                  className={`flex items-start gap-3 min-w-0 flex-1 ${n.isRead ? "" : "cursor-pointer"}`}
                >
                  <div
                    className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5`}
                    style={n.isRead ? {background: '#f4f6f8', color: '#6b7280'} : {background: '#cce5ff', color: '#1f5fa8'}}
                  >
                    {n.isRead ? <CheckCheck size={14} /> : <Bell size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-semibold truncate`}
                      style={{color: n.isRead ? '#6b7280' : '#2b2f36'}}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[12px] mt-0.5 line-clamp-2" style={{color: '#6b7280'}}>{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={11} style={{color: '#d1d5db'}} />
                      <span className="text-[11px] font-mono" style={{color: '#6b7280'}}>
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[11px]" style={{color: '#d1d5db'}}>·</span>
                      <span className="text-[11px]" style={{color: '#6b7280'}}>{n.eventType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.isRead && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border" style={{color: '#1f5fa8', background: '#cce5ff', borderColor: '#9ecbff'}}>
                      Unread
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deletingId === n.id}
                    title="Delete notification"
                    className="p-1.5 rounded-md transition-colors disabled:opacity-50"
                    style={{color: '#9ca3af'}}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
