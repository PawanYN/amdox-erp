import { Employee, AttendanceRecord, LeaveRequest, PayrollRun } from '../types';
import { fetchWrapper } from './fetch-wrapper';

export const hrApi = {
  // Employees
  getEmployees: () => fetchWrapper<Employee[]>('/hr/employees'),
  getEmployee: (id: string) => fetchWrapper<Employee>(`/hr/employees/${id}`),
  createEmployee: (data: Partial<Employee>) => fetchWrapper<Employee>('/hr/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Attendance
  getAllAttendance: () => fetchWrapper<AttendanceRecord[]>('/hr/attendance/all'),
  clockIn: (data: { employeeId: string; location?: string }) => fetchWrapper<AttendanceRecord>('/hr/attendance/clock-in', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  clockOut: (employeeId: string) => fetchWrapper<AttendanceRecord>(`/hr/attendance/clock-out/${employeeId}`, {
    method: 'POST',
  }),

  // Leave
  getAllLeaveRequests: () => fetchWrapper<LeaveRequest[]>('/hr/leave/all-requests'),
  createLeaveRequest: (data: Partial<LeaveRequest>) => fetchWrapper<LeaveRequest>('/hr/leave', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  approveLeaveRequest: (id: string, data: { status: 'APPROVED' | 'REJECTED'; notes?: string }) => fetchWrapper<LeaveRequest>(`/hr/leave/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // Payroll
  getPayroll: (period: string) => fetchWrapper<{ data: PayrollRun[] }>(`/hr/payroll?period=${period}`).then(res => res.data),
  runPayroll: (period: string) => fetchWrapper<{ payrollRunId: string }>('/hr/payroll/run', {
    method: 'POST',
    body: JSON.stringify({ payPeriod: period }),
  }),
};
