"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationApi } from "@/lib/api/notification-api";

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    notificationApi
      .list()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleMarkRead(id: string) {
    const item = items.find((n) => n.id === id);
    if (!item || item.isRead) return;

    setMarkingId(id);
    try {
      await notificationApi.markRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Bell size={20} />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>
      <p className="text-sm text-muted mb-4">
        In-app notifications (email/SMS logged to API terminal in dev — no credentials required).
        Click an unread notification to mark it as read.
      </p>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => handleMarkRead(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleMarkRead(n.id);
                }
              }}
              className={`border rounded-lg p-3 transition-colors ${
                n.isRead
                  ? "border-[#E4E2DC] bg-white cursor-default"
                  : "border-[#1E3A5F]/30 bg-[#1E3A5F]/5 cursor-pointer hover:bg-[#1E3A5F]/10"
              } ${markingId === n.id ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm">{n.title}</p>
                {!n.isRead && (
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full">
                    Unread
                  </span>
                )}
              </div>
              {n.body && (
                <p className="text-[12px] text-muted mt-1">{n.body}</p>
              )}
              <p className="text-[10px] text-[#8A8678] mt-2 font-mono">
                {n.eventType} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
