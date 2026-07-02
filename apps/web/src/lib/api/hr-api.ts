import { apiClient } from './client';

export const hrApi = {
  getEmployees: () => apiClient('/employees'),
  getAllAttendance: () => apiClient('/attendance/all'),
  getAllLeaveRequests: () => apiClient('/leave/all-requests'),
  getPayroll: (period: string) => apiClient(`/payroll?period=${encodeURIComponent(period)}`),
  runPayroll: (period: string) =>
    apiClient('/payroll/run', {
      method: 'POST',
      body: JSON.stringify({ payPeriod: period }),
    }),
};
