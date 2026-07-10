"use client";

import { useKeycloak } from "@/components/KeycloakProvider";
import {
  Shield,
  Calendar,
  Clock,
  Zap,
  LogOut,
  UserCircle,
  CalendarDays,
  Wallet,
  CheckCircle2,
  XCircle,
  Timer,
  Download,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { hrApi } from "@/lib/api/hr-api";
import { apiClient } from "@/lib/api/client";

type Profile = {
  id: string;
  fullName?: string;
  email?: string;
  designation?: string;
  department?: { name?: string };
  manager?: { fullName?: string };
};
type AuthMe = {
  email?: string;
  fullName?: string;
  roles?: string[];
};
type LeaveBalance = { leaveType: { id: string; name: string }; balanceDays: number };
type LeaveRequest = {
  id: string;
  leaveType?: { name: string };
  startDate: string;
  endDate: string;
  status: string;
};
type RawAttendanceRecord = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  overtimeMins: number | null;
};
type Payslip = {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: string;
  payslipUrl: string | null;
};

const HOME_TABS = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "attendance-leave", label: "Attendance & Leave", icon: CalendarDays },
  { id: "pay", label: "Pay", icon: Wallet },
] as const;
type HomeTabId = (typeof HOME_TABS)[number]["id"];

function resolveErpAccess(roles: string[]) {
  const has = (role: string) => roles.includes(role);
  if (has("SuperAdmin")) {
    return { label: "Super Admin", access: "Full Access", isAdmin: true, isManager: false };
  }
  if (has("TenantAdmin")) {
    return { label: "Tenant Admin", access: "Full Access", isAdmin: true, isManager: false };
  }
  if (has("Manager")) {
    return { label: "Manager", access: "Manager Access", isAdmin: false, isManager: true };
  }
  if (has("Viewer")) {
    return { label: "Viewer", access: "Read-only Access", isAdmin: false, isManager: false };
  }
  return { label: "Employee", access: "Employee Access", isAdmin: false, isManager: false };
}

function tokenDisplayName(token: string | undefined): string {
  if (!token) return "Loading…";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.name || payload.preferred_username || "Unknown";
  } catch {
    return "Unknown";
  }
}

function tokenDisplayEmail(token: string | undefined): string {
  if (!token) return "Loading…";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email || "Unknown";
  } catch {
    return "Unknown";
  }
}

/** "2026-07" -> the previous calendar month, e.g. run on 10 Jul 2026 gives "2026-06". */
function lastCompletedMonthPeriod(): { period: string; label: string } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const y = lastMonth.getFullYear();
  const m = String(lastMonth.getMonth() + 1).padStart(2, "0");
  const label = lastMonth.toLocaleString("en-US", { month: "long", year: "numeric" });
  return { period: `${y}-${m}`, label };
}

/** Count Mon–Fri calendar days in the given year/month (1-indexed month). */
function countWeekdaysInMonth(year: number, month1to12: number): number {
  let count = 0;
  const cursor = new Date(year, month1to12 - 1, 1);
  while (cursor.getMonth() === month1to12 - 1) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

const LATE_THRESHOLD_UTC_MINUTES = 4 * 60; // 04:00 UTC = 09:30 IST

export default function DashboardHome() {
  const { token } = useKeycloak();
  const [activeTab, setActiveTab] = useState<HomeTabId>("profile");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [todaysClockIn, setTodaysClockIn] = useState<Date | null>(null);
  const [authMe, setAuthMe] = useState<AuthMe | null>(null);
  const [authMeLoaded, setAuthMeLoaded] = useState(false);

  const [attendanceRecords, setAttendanceRecords] = useState<RawAttendanceRecord[]>([]);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [payslipError, setPayslipError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const erpRoles = authMe?.roles ?? [];
  const {
    label: roleLabel,
    access: accessLabel,
    isAdmin,
  } = useMemo(() => resolveErpAccess(erpRoles), [erpRoles]);

  const displayName = profile?.fullName || authMe?.fullName || tokenDisplayName(token);
  const displayEmail = profile?.email || authMe?.email || tokenDisplayEmail(token);

  const { period: lastMonthPeriod, label: lastMonthLabel } = useMemo(
    () => lastCompletedMonthPeriod(),
    [],
  );

  useEffect(() => {
    if (!token) {
      setAuthMe(null);
      setAuthMeLoaded(false);
      return;
    }

    (async () => {
      setAuthMeLoaded(false);
      try {
        const me = (await apiClient("/auth/me")) as AuthMe;
        setAuthMe(me);
      } catch {
        setAuthMe({ roles: ["Employee"] });
      } finally {
        setAuthMeLoaded(true);
      }

      let prof: Profile | null = null;
      try {
        prof = await hrApi.getMe();
        setProfile(prof);
      } catch {
        setProfile(null);
      }
      if (!prof?.id) return;
      try {
        const status = await hrApi.getAttendanceStatus(prof.id);
        setClockedIn(status.clockedIn);
        if (status.record?.clockIn) setTodaysClockIn(new Date(status.record.clockIn));
        const b = await hrApi.getMyLeaveBalances(prof.id);
        setBalances(b);
        if (b.length > 0) setLeaveType(b[0].leaveType.name);
        setRequests(await hrApi.getMyLeaveRequests(prof.id));
      } catch {}

      try {
        const records: RawAttendanceRecord[] = await hrApi.getMyAttendanceRecords(prof.id);
        setAttendanceRecords(records);
      } catch {
        setAttendanceRecords([]);
      } finally {
        setAttendanceLoaded(true);
      }

      setPayslipLoading(true);
      setPayslipError(null);
      try {
        const { period } = lastCompletedMonthPeriod();
        const res = await hrApi.getMyPayroll(period);
        setPayslip(res?.data ?? null);
      } catch (err) {
        setPayslipError(err instanceof Error ? err.message : "Failed to load payslip.");
      } finally {
        setPayslipLoading(false);
      }
    })();
  }, [token]);

  const handleClockIn = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockIn(profile.id);
      setClockedIn(true);
      setTodaysClockIn(new Date());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockOut(profile.id);
      setClockedIn(false);
      setTodaysClockIn(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clock out");
    }
  };

  const submitLeave = async () => {
    if (!profile?.id || !leaveType || !startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      await hrApi.createLeaveRequest({
        employeeId: profile.id,
        leaveType: leaveType.toLowerCase().includes("sick") ? "sick" : "annual",
        startDate,
        endDate,
        reason: reason || "Leave requested from dashboard",
      });
      setShowLeaveForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setRequests(await hrApi.getMyLeaveRequests(profile.id));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPayslip = async () => {
    if (!payslip) return;
    setDownloading(true);
    try {
      const blob = await hrApi.downloadMyPayslip(payslip.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${payslip.payPeriod}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to download payslip");
    } finally {
      setDownloading(false);
    }
  };

  const annualBalance =
    balances.find((b) => b.leaveType?.name === "Annual Leave")?.balanceDays || 0;
  const sickBalance = balances.find((b) => b.leaveType?.name === "Sick Leave")?.balanceDays || 0;

  const monthlyAttendance = useMemo(() => {
    const [y, m] = lastMonthPeriod.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const inMonth = attendanceRecords.filter((r) => {
      const d = new Date(r.clockIn);
      return d >= monthStart && d < monthEnd;
    });

    const present = inMonth.length;
    const totalWorkdays = countWeekdaysInMonth(y, m);
    const absent = Math.max(totalWorkdays - present, 0);
    const late = inMonth.filter((r) => {
      const d = new Date(r.clockIn);
      return d.getUTCHours() * 60 + d.getUTCMinutes() > LATE_THRESHOLD_UTC_MINUTES;
    }).length;
    const overtimeHours = inMonth.reduce((sum, r) => sum + (r.overtimeMins || 0), 0) / 60;

    return { present, absent, late, totalWorkdays, overtimeHours };
  }, [attendanceRecords, lastMonthPeriod]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5">
      {/* Persistent header: identity + clock in/out — always visible, no scrolling needed */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5 flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-base sm:text-lg font-semibold shrink-0">
          {displayName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
            {displayName}
          </h1>
          <p className="text-[13px] text-slate-500 truncate">{displayEmail}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
          <Shield size={12} />
          {!authMeLoaded ? "…" : roleLabel}
        </span>

        {!isAdmin && profile?.id && (
          <button
            onClick={clockedIn ? handleClockOut : handleClockIn}
            className={`shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-md transition-colors ${
              clockedIn
                ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                : "bg-emerald-700 text-white hover:bg-emerald-800"
            }`}
          >
            {clockedIn ? (
              <>
                <LogOut size={13} /> Clock Out
                {todaysClockIn && (
                  <span className="hidden sm:inline text-[10px] font-normal opacity-70">
                    (since{" "}
                    {todaysClockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                  </span>
                )}
              </>
            ) : (
              <>
                <Zap size={13} /> Clock In
              </>
            )}
          </button>
        )}
      </div>

      {/* Horizontal tab bar */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {HOME_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
          <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Profile Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ["Job Title", isAdmin ? "—" : profile?.designation || "—"],
              ["Department", isAdmin ? "Administration" : profile?.department?.name || "—"],
              ["Reports To", isAdmin ? "—" : profile?.manager?.fullName || "—"],
              ["Access", accessLabel],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                  {label}
                </p>
                <p className="text-[13px] text-slate-800 font-medium mt-0.5">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ATTENDANCE & LEAVE TAB */}
      {activeTab === "attendance-leave" && !isAdmin && (
        <div className="space-y-4 sm:space-y-5">
          {/* Attendance summary */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Attendance — {lastMonthLabel}
            </p>
            {!attendanceLoaded ? (
              <p className="text-[13px] text-slate-500">Loading attendance…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Present
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {monthlyAttendance.present}
                    <span className="text-[13px] font-medium text-slate-400">
                      /{monthlyAttendance.totalWorkdays}
                    </span>
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <XCircle size={13} className="text-red-500" />
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Absent
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{monthlyAttendance.absent}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock size={13} className="text-amber-600" />
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Late
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{monthlyAttendance.late}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Timer size={13} className="text-blue-600" />
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Overtime
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {monthlyAttendance.overtimeHours.toFixed(1)}
                    <span className="text-[13px] font-medium text-slate-400"> hrs</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Leave balance cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar size={13} className="text-slate-500" />
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Annual Leave
                </p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{annualBalance}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">days remaining</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={13} className="text-slate-500" />
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Sick Leave
                </p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{sickBalance}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">days remaining</p>
            </div>
          </div>

          {/* Leave requests */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-slate-900">Recent Leave Requests</p>
              <button
                onClick={() => setShowLeaveForm(!showLeaveForm)}
                className="text-[12px] font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
              >
                {showLeaveForm ? "Cancel" : "Apply for Leave"}
              </button>
            </div>

            {showLeaveForm ? (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3 animate-fade-in-up">
                <p className="text-[12px] font-semibold text-slate-700">New Leave Application</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                      Leave Type
                    </label>
                    <select
                      className="input-base"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                    >
                      {balances.map((b) => (
                        <option key={b.leaveType.id} value={b.leaveType.name}>
                          {b.leaveType.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="input-base"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="input-base"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Brief reason…"
                      className="input-base"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={submitLeave}
                  disabled={isSubmitting || !startDate || !endDate || !leaveType}
                  className="w-full py-2 bg-slate-900 text-white text-[12px] font-semibold rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.length === 0 ? (
                  <p className="text-[13px] text-slate-500 italic">No leave requests found.</p>
                ) : (
                  requests.slice(0, 5).map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-md border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">
                          {req.leaveType?.name || "Leave"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(req.startDate).toLocaleDateString()} –{" "}
                          {new Date(req.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          req.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : req.status === "REJECTED"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAY TAB */}
      {activeTab === "pay" && !isAdmin && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
          <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Pay — {lastMonthLabel}
          </p>

          {payslipLoading ? (
            <p className="text-[13px] text-slate-500">Loading payslip…</p>
          ) : payslipError ? (
            <p className="text-[13px] text-red-600">{payslipError}</p>
          ) : !payslip ? (
            <p className="text-[13px] text-slate-500 italic">
              No payslip has been processed for {lastMonthLabel} yet. Check back after payroll is
              run for this period.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Gross Pay
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    ₹{payslip.grossPay.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Deductions
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    -₹{payslip.deductions.toLocaleString("en-IN")}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Net Pay
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    ₹{payslip.netPay.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadPayslip}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                {downloading ? "Downloading…" : "Download Payslip"}
              </button>
            </div>
          )}
        </div>
      )}

      {isAdmin && activeTab !== "profile" && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-4 sm:p-5">
          <p className="text-[13px] text-slate-500 italic">
            Admin accounts aren&apos;t linked to an employee profile, so attendance, leave, and pay
            aren&apos;t applicable here.
          </p>
        </div>
      )}
    </div>
  );
}
