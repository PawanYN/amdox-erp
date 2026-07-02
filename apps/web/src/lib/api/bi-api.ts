import { apiClient, apiBlobClient, API_BASE_URL } from './client';
import { ensureFreshToken } from '../auth';

export type BiDataSource =
  | 'ar_aging'
  | 'inventory'
  | 'purchase_orders'
  | 'employees_by_department'
  | 'project_funnel'
  | 'resource_heatmap';

export type WidgetType = 'bar' | 'line' | 'pie' | 'heatmap' | 'funnel' | 'gauge' | 'card' | 'waterfall' | 'scatter' | 'treemap';

export type BiFilterParams = {
  period?: string;
  department?: string;
  status?: string;
};

function filterQuery(filters?: BiFilterParams): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.period && filters.period !== 'all') params.set('period', filters.period);
  if (filters.department && filters.department !== 'all') params.set('department', filters.department);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const biApi = {
  getKpis: (filters?: BiFilterParams) => apiClient(`/bi/kpis${filterQuery(filters)}`),
  getDashboards: () => apiClient('/bi/dashboards'),
  getDashboard: (id: string) => apiClient(`/bi/dashboards/${id}`),
  createDashboard: (name: string) =>
    apiClient('/bi/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateDashboard: (id: string, data: { name?: string; layout?: object }) =>
    apiClient(`/bi/dashboards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteDashboard: (id: string) =>
    apiClient(`/bi/dashboards/${id}`, { method: 'DELETE' }),
  addWidget: (dashboardId: string, type: WidgetType, config: object) =>
    apiClient('/bi/dashboards/widgets', {
      method: 'POST',
      body: JSON.stringify({ dashboardId, type, config }),
    }),
  updateWidget: (id: string, data: { type?: string; config?: object }) =>
    apiClient(`/bi/widgets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteWidget: (id: string) =>
    apiClient(`/bi/widgets/${id}`, { method: 'DELETE' }),
  getWidgetData: (id: string, filters?: BiFilterParams) =>
    apiClient(`/bi/widgets/${id}/data${filterQuery(filters)}`),
  getDataBySource: (source: BiDataSource, filters?: BiFilterParams) =>
    apiClient(`/bi/data/${source}${filterQuery(filters)}`),
  drillDown: (dataSource: BiDataSource, filterKey: string, filterValue?: string) =>
    apiClient('/bi/drill-down', {
      method: 'POST',
      body: JSON.stringify({ dataSource, filterKey, filterValue }),
    }),
  listReports: () => apiClient('/bi/reports'),
  getReports: () => apiClient('/bi/reports'),
  createReport: (data: {
    name: string;
    cronExpr: string;
    format: 'PDF' | 'EXCEL';
    recipients: string[];
    dashboardId?: string;
  }) =>
    apiClient('/bi/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteReport: (id: string) =>
    apiClient(`/bi/reports/${id}`, { method: 'DELETE' }),
  runReport: (id: string) =>
    apiClient(`/bi/reports/${id}/run`, { method: 'POST' }),
  downloadReport: (id: string) => apiBlobClient(`/bi/reports/${id}/download`),
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** SSE metrics stream with Authorization header and exponential backoff reconnect. */
export async function subscribeBiMetricsStream(
  onData: (kpis: unknown) => void,
  onError?: (err: Error) => void,
  filters?: BiFilterParams,
): Promise<() => void> {
  let aborted = false;
  let retries = 0;
  const maxRetries = 8;

  const connect = async () => {
    while (!aborted && retries <= maxRetries) {
      const controller = new AbortController();
      const token = await ensureFreshToken();

      try {
        const response = await fetch(
          `${API_BASE_URL}/bi/metrics/stream${filterQuery(filters)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) {
          throw new Error(`SSE failed: ${response.status}`);
        }

        retries = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
            if (dataLine) {
              const json = dataLine.replace(/^data:\s*/, '');
              try {
                onData(JSON.parse(json));
              } catch {
                /* ignore partial chunks */
              }
            }
          }
        }
      } catch (err: unknown) {
        if (aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.name === 'AbortError') return;
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
