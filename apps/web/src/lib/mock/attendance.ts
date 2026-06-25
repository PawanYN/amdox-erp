import { AttendanceRecord } from "../types";

export const mockAttendance: AttendanceRecord[] = [
  {
    id: "ATT-001",
    employeeId: "EMP-101",
    employeeName: "Aarav Sharma",
    date: "2026-06-22",
    clockIn: "09:02",
    clockOut: "18:14",
    totalHours: 9.2,
    overtimeHours: null,
  },
  {
    id: "ATT-002",
    employeeId: "EMP-102",
    employeeName: "Riya Patel",
    date: "2026-06-22",
    clockIn: "09:45",
    clockOut: "19:30",
    totalHours: 9.75,
    overtimeHours: 1.25,
  },
  {
    id: "ATT-003",
    employeeId: "EMP-103",
    employeeName: "Vikram Singh",
    date: "2026-06-22",
    clockIn: "08:55",
    clockOut: "17:50",
    totalHours: 8.9,
    overtimeHours: null,
  },
  {
    id: "ATT-004",
    employeeId: "EMP-104",
    employeeName: "Sneha Iyer",
    date: "2026-06-22",
    clockIn: "10:05",
    clockOut: "18:40",
    totalHours: 8.6,
    overtimeHours: null,
  },
];

// Standard shift length used to derive overtime client-side for the
// logged-in user's mock clock button. Backend will own this calculation
// for real once Task 4 (Connect to backend API) lands.
export const STANDARD_SHIFT_HOURS = 8.5;
