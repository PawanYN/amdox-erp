// Shared domain types for the HR module.
// These mirror the eventual API response shapes — see lib/api/contracts.ts
// for the full request/response contract handed to the backend team.

export type EmployeeStatus = "Active" | "Inactive";

export interface Employee {
  id: string; // e.g. "EMP-101"
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  contractType: "Full-time" | "Part-time" | "Contract" | "Intern";
  startDate: string; // ISO date
  reportsToId: string | null; // Employee.id of manager, null for top of org
  status: EmployeeStatus;
}

export type LeaveType = "Sick Leave" | "Earned Leave" | "Casual Leave" | "Unpaid Leave";
export type LeaveStatus = "Pending" | "Approved" | "Rejected";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  fromDate: string; // ISO date
  toDate: string; // ISO date
  days: number;
  reason: string;
  status: LeaveStatus;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // ISO date
  clockIn: string | null; // "HH:mm"
  clockOut: string | null; // "HH:mm"
  totalHours: number | null;
  overtimeHours: number | null;
}

export type PayrollStatus = "Processed" | "Pending";

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string; // e.g. "Jun 2026"
  grossPay: number;
  deductions: number;
  netPay: number;
  status: PayrollStatus;
  payslipUrl: string | null; // only present once Processed
}

export type UserRole = "Manager" | "Employee";

export interface CurrentUser {
  employeeId: string;
  name: string;
  role: UserRole;
}
