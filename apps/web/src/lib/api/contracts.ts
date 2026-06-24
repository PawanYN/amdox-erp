/**
 * HR MODULE — API CONTRACT
 * ─────────────────────────
 * This file is the source of truth for what the frontend needs from each
 * endpoint. It is not called anywhere yet — Task 5 ("Connect to backend
 * API") on each screen will replace the mock data in lib/mock/* with real
 * fetches matching these shapes. Until then, this doubles as the handoff
 * spec for the backend team.
 *
 * Conventions:
 * - All list endpoints return { data: T[] }.
 * - All dates are ISO 8601 strings ("YYYY-MM-DD").
 * - All money values are numbers in INR, no currency symbol, no commas.
 * - Errors return { error: { code: string; message: string } } with a
 *   4xx/5xx status.
 */

import {
  AttendanceRecord,
  Employee,
  LeaveRequest,
  PayrollRecord,
} from "../types";

/* ──────────────────────────  Employees  ────────────────────────── */

// GET /api/hr/employees
export interface GetEmployeesResponse {
  data: Employee[];
}

// POST /api/hr/employees
export interface CreateEmployeeRequest {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  contractType: Employee["contractType"];
  startDate: string;
  reportsToId: string | null;
}
export interface CreateEmployeeResponse {
  data: Employee; // includes server-generated id, status defaults to "Active"
}

// GET /api/hr/org-chart
// Returns the same Employee[] shape — the frontend derives the tree from
// reportsToId, so no separate nested structure is needed.
export interface GetOrgChartResponse {
  data: Employee[];
}

/* ────────────────────────  Leave Requests  ─────────────────────── */

// GET /api/hr/leave-requests
export interface GetLeaveRequestsResponse {
  data: LeaveRequest[];
}

// POST /api/hr/leave-requests
export interface CreateLeaveRequestRequest {
  employeeId: string;
  leaveType: LeaveRequest["leaveType"];
  fromDate: string;
  toDate: string;
  reason: string;
}
export interface CreateLeaveRequestResponse {
  data: LeaveRequest; // days computed server-side, status defaults to "Pending"
}

// POST /api/hr/leave-requests/:id/approve
// POST /api/hr/leave-requests/:id/reject
// Both take no body. 403 if the caller is not a Manager.
export interface UpdateLeaveStatusResponse {
  data: LeaveRequest; // updated status
}

/* ───────────────────────────  Attendance  ──────────────────────── */

// GET /api/hr/attendance?date=YYYY-MM-DD  (defaults to today)
export interface GetAttendanceResponse {
  data: AttendanceRecord[];
}

// POST /api/hr/attendance/clock-in
// Body: {} — server infers employee from session, sets clockIn to now.
// POST /api/hr/attendance/clock-out
// Body: {} — server sets clockOut to now and computes totalHours +
// overtimeHours against the configured standard shift length.
export interface ClockActionResponse {
  data: AttendanceRecord;
}

/* ────────────────────────────  Payroll  ────────────────────────── */

// GET /api/hr/payroll?period=YYYY-MM
export interface GetPayrollResponse {
  data: PayrollRecord[];
}

// POST /api/hr/payroll/run
export interface RunPayrollRequest {
  payPeriod: string; // "Jun 2026"
}
// This is a batch job — expect this to return 202 Accepted with a jobId,
// not the final records. Frontend will poll or expect a webhook/refetch.
export interface RunPayrollResponse {
  jobId: string;
  status: "queued" | "running";
}

// GET /api/hr/payroll/:id/payslip
// Returns a PDF (Content-Type: application/pdf), not JSON.
