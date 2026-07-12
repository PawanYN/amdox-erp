import { apiClient, apiBlobClient } from "./client";

export const hrApi = {
  getEmployees: (scope: "active" | "inactive" | "all" = "active") =>
    apiClient(`/employees?scope=${scope}`),
  getDepartments: () => apiClient("/departments"),
  createEmployee: (body: Record<string, unknown>) =>
    apiClient("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiClient(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteEmployee: (id: string) => apiClient(`/employees/${id}`, { method: "DELETE" }),
  restoreEmployee: (id: string) => apiClient(`/employees/${id}/restore`, { method: "PATCH" }),

  getMe: () => apiClient("/employees/me"),
  getAllAttendance: () => apiClient("/attendance/all"),
  getAttendanceStatus: (employeeId: string) => apiClient(`/attendance/status/${employeeId}`),
  getMyAttendanceRecords: (employeeId: string) => apiClient(`/attendance/my-records/${employeeId}`),
  clockIn: (employeeId: string) =>
    apiClient("/attendance/clock-in", {
      method: "POST",
      body: JSON.stringify({ employeeId, source: "api" }),
    }),
  clockOut: (employeeId: string) =>
    apiClient(`/attendance/clock-out/${employeeId}`, { method: "POST" }),

  getAllLeaveRequests: () => apiClient("/leave/all-requests"),
  getMyLeaveBalances: (employeeId: string) => apiClient(`/leave/my-balances/${employeeId}`),
  getMyLeaveRequests: (employeeId: string) => apiClient(`/leave/my-requests/${employeeId}`),
  createLeaveRequest: (body: Record<string, unknown>) =>
    apiClient("/leave", { method: "POST", body: JSON.stringify(body) }),
  approveLeaveRequest: (id: string, body: Record<string, unknown>) =>
    apiClient(`/leave/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  rejectLeaveRequest: (id: string, managerEmployeeId: string) =>
    apiClient(`/leave/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ managerEmployeeId }),
    }),

  getPayroll: (period: string) => apiClient(`/hr/payroll?period=${encodeURIComponent(period)}`),
  getMyPayroll: (period: string) =>
    apiClient(`/hr/payroll/mine?period=${encodeURIComponent(period)}`),
  runPayroll: (period: string) =>
    apiClient("/hr/payroll/run", {
      method: "POST",
      body: JSON.stringify({ payPeriod: period }),
    }),
  downloadPayslip: (payslipId: string) => apiBlobClient(`/hr/payroll/${payslipId}/payslip`),
  downloadMyPayslip: (payslipId: string) => apiBlobClient(`/hr/payroll/mine/${payslipId}/payslip`),

  getStatutoryCompliance: () => apiClient("/hr/compliance/statutory"),
  updateStatutoryCompliance: (body: Record<string, unknown>) =>
    apiClient("/hr/compliance/statutory", { method: "PATCH", body: JSON.stringify(body) }),
  getTaxSlabs: () => apiClient("/hr/compliance/tax-slabs"),
  createTaxSlab: (body: Record<string, unknown>) =>
    apiClient("/hr/compliance/tax-slabs", { method: "POST", body: JSON.stringify(body) }),
  deleteTaxSlab: (id: string) => apiClient(`/hr/compliance/tax-slabs/${id}`, { method: "DELETE" }),

  createDepartment: (body: Record<string, unknown>) =>
    apiClient("/departments", { method: "POST", body: JSON.stringify(body) }),
  updateDepartment: (id: string, body: Record<string, unknown>) =>
    apiClient(`/departments/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDepartment: (id: string) => apiClient(`/departments/${id}`, { method: "DELETE" }),
};
