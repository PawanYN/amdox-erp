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
            <Bell size={18} className="text-slate-500" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 h-5 min-w-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="page-subtitle mt-1">In-app alerts — click unread to mark as read</p>
        </div>
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border ${
            liveStatus === "live"
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : liveStatus === "error"
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-slate-500 bg-slate-50 border-slate-200"
          }`}
          title="Server-Sent Events connection"
        >
          <Radio size={12} />
          {liveStatus === "live" ? "Live" : liveStatus === "error" ? "Reconnecting" : "Connecting"}
        </div>
      </div>

      {/* Preferences */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Settings2 size={14} className="text-slate-500" />
          <h2 className="text-[13px] font-semibold text-slate-800">Channel preferences</h2>
          <span className="text-[11px] text-slate-500 ml-auto">
            Opt-out model — channels default to on
          </span>
        </div>

        {prefsError && (
          <div className="mx-4 mt-3 text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
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
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Event
                  </th>
                  {CHANNELS.map((ch) => (
                    <th
                      key={ch.id}
                      className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center"
                    >
                      {ch.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVENT_TYPES.map((eventType) => (
                  <tr key={eventType} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 text-[12px] font-mono text-slate-700">
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
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
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
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
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
            className={`text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors ${
              readFilter === f.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label} <span className="text-slate-400">{f.count}</span>
          </button>
        ))}
      </div>

      {listError && (
        <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {listError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Bell size={18} className="text-slate-300" />
          </div>
          <p className="text-[13px] text-slate-500">
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
              className={`rounded-lg border p-4 transition-all duration-150 ${
                n.isRead
                  ? "border-slate-100 bg-white"
                  : "border-blue-100 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-200"
              } ${markingId === n.id || deletingId === n.id ? "opacity-50" : ""}`}
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
                    className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                      n.isRead ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {n.isRead ? <CheckCheck size={14} /> : <Bell size={14} />}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-[13px] font-semibold truncate ${n.isRead ? "text-slate-700" : "text-slate-900"}`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Clock size={11} className="text-slate-300" />
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-300">·</span>
                      <span className="text-[11px] text-slate-500">{n.eventType}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!n.isRead && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">
                      Unread
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deletingId === n.id}
                    title="Delete notification"
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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
