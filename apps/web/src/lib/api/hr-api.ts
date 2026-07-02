import { apiClient, apiBlobClient } from './client';

export const hrApi = {
  getEmployees: () => apiClient('/employees'),
  getDepartments: () => apiClient('/departments'),
  createEmployee: (body: Record<string, unknown>) =>
    apiClient('/employees', { method: 'POST', body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiClient(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEmployee: (id: string) =>
    apiClient(`/employees/${id}`, { method: 'DELETE' }),

  getMe: () => apiClient('/employees/me'),
  getAllAttendance: () => apiClient('/attendance/all'),
  getAttendanceStatus: (employeeId: string) =>
    apiClient(`/attendance/status/${employeeId}`),
  clockIn: (employeeId: string) =>
    apiClient('/attendance/clock-in', {
      method: 'POST',
      body: JSON.stringify({ employeeId, source: 'api' }),
    }),
  clockOut: (employeeId: string) =>
    apiClient(`/attendance/clock-out/${employeeId}`, { method: 'POST' }),

  getAllLeaveRequests: () => apiClient('/leave/all-requests'),
  getMyLeaveBalances: (employeeId: string) =>
    apiClient(`/leave/my-balances/${employeeId}`),
  getMyLeaveRequests: (employeeId: string) =>
    apiClient(`/leave/my-requests/${employeeId}`),
  createLeaveRequest: (body: Record<string, unknown>) =>
    apiClient('/leave', { method: 'POST', body: JSON.stringify(body) }),

  getPayroll: (period: string) =>
    apiClient(`/hr/payroll?period=${encodeURIComponent(period)}`),
  runPayroll: (period: string) =>
    apiClient('/hr/payroll/run', {
      method: 'POST',
      body: JSON.stringify({ payPeriod: period }),
    }),
  downloadPayslip: (payslipId: string) =>
    apiBlobClient(`/hr/payroll/${payslipId}/payslip`),

  createDepartment: (body: Record<string, unknown>) =>
    apiClient('/departments', { method: 'POST', body: JSON.stringify(body) }),
  updateDepartment: (id: string, body: Record<string, unknown>) =>
    apiClient(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteDepartment: (id: string) =>
    apiClient(`/departments/${id}`, { method: 'DELETE' }),
};
