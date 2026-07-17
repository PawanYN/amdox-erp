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
  departmentId?: string;
  designation: string;
  contractType: "Full-time" | "Part-time" | "Contract" | "Intern";
  startDate: string; // ISO date
  reportsToId: string | null; // Employee.id of manager, null for top of org
  status: EmployeeStatus;
  dateOfBirth?: string;
  /** Monthly gross salary. Backs the employee's EmploymentContract, which payroll reads from. */
  salary?: number;
  currencyCode?: string;
}

/** Payload from the add-employee wizard (extends API-bound fields with form-only data). */
export type NewEmployeeInput = Omit<Employee, "id" | "status"> & {
  dateOfBirth?: string;
  /** ERP system role when portal login is enabled */
  systemRole?: "TenantAdmin" | "Manager" | "Viewer" | "Employee";
  /** When false, only HR record is created — no login */
  provideErpAccess?: boolean;
  /** ERP sidebar tabs this person can access (when empty, inherits department defaults) */
  allowedModules?: string[];
};

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

// --- SCM Types ---

export type InventoryStatus = "In Stock" | "Low Stock" | "Out of Stock";

export interface InventoryItem {
  id: string; // e.g. "ITM-001"
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unitPrice: number;
  status: InventoryStatus;
}

export type POStatus = "Draft" | "Sent" | "Fulfilled" | "Cancelled";

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendorName: string;
  date: string;
  amount: number;
  status: POStatus;
}

export type VendorStatus = "Active" | "Inactive";

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  rating: number; // 1 to 5
  status: VendorStatus;
}

// --- Finance Types ---

export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

export interface Account {
  id: string; // e.g. "1010"
  name: string;
  type: AccountType;
  balance: number;
}

export type JournalStatus = "Draft" | "Posted";

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  status: JournalStatus;
}

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

export interface AgingRecord {
  clientId: string;
  clientName: string;
  current: number;
  days30: number; // 1-30 Days
  days60: number; // 31-60 Days
  days90: number; // 61-90 Days
  days90Plus: number; // 90+ Days
  total: number;
}
