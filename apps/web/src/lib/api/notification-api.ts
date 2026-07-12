import { apiClient, API_BASE_URL } from "./client";
import { ensureFreshToken } from "../auth";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";

export type NotificationPreference = {
  id: string;
  tenantId: string;
  userId: string;
  eventType: string;
  channel: NotificationChannel;
  isEnabled: boolean;
};

export type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  eventType?: string;
  createdAt: string;
  isRead: boolean;
  userId?: string | null;
};

export type SetPreferenceInput = {
  eventType: string;
  channel: NotificationChannel;
  isEnabled: boolean;
};

export const notificationApi = {
  list: () => apiClient("/notifications") as Promise<NotificationItem[]>,
  markRead: (id: string) => apiClient(`/notifications/${id}/read`, { method: "PATCH" }),
  remove: (id: string) => apiClient(`/notifications/${id}`, { method: "DELETE" }),
  getPreferences: () =>
    apiClient("/notifications/preferences") as Promise<NotificationPreference[]>,
  setPreference: (data: SetPreferenceInput) =>
    apiClient("/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    }) as Promise<NotificationPreference>,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SSE notification stream with Authorization header and exponential backoff reconnect. */
export async function subscribeNotificationStream(
  onData: (notification: NotificationItem) => void,
  onError?: (err: Error) => void,
): Promise<() => void> {
  let aborted = false;
  let retries = 0;
  const maxRetries = 8;

  const connect = async () => {
    while (!aborted && retries <= maxRetries) {
      const controller = new AbortController();
      const token = await ensureFreshToken();

      try {
        const response = await fetch(`${API_BASE_URL}/notifications/stream`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error(`SSE failed: ${response.status}`);
        }

        retries = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            const dataLine = part.split("\n").find((l) => l.startsWith("data:"));
            if (dataLine) {
              const json = dataLine.replace(/^data:\s*/, "");
              try {
                onData(JSON.parse(json) as NotificationItem);
              } catch {
                /* ignore partial chunks */
              }
            }
          }
        }
      } catch (err: unknown) {
        if (aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.name === "AbortError") return;
        onError?.(error);
        retries += 1;
        const delay = Math.min(1000 * 2 ** retries, 30000);
        await sleep(delay);
      } finally {
        controller.abort();
      }
    }
  };

  connect();

  return () => {
    aborted = true;
  };
}
