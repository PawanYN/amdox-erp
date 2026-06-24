"use client";

import { useState } from "react";
import { Clock as ClockIcon, LogOut, Timer, TrendingUp, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { mockAttendance, STANDARD_SHIFT_HOURS } from "@/lib/mock/attendance";
import { currentUser } from "@/lib/current-user";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AttendancePage() {
  const [records, setRecords] = useState(mockAttendance);
  const [clockedIn, setClockedIn] = useState(false);
  const [todaysClockIn, setTodaysClockIn] = useState<Date | null>(null);

  function handleClockIn() {
    setClockedIn(true);
    setTodaysClockIn(new Date());
  }

  function handleClockOut() {
    if (!todaysClockIn) return;
    const clockOutTime = new Date();
    const hours = (clockOutTime.getTime() - todaysClockIn.getTime()) / (1000 * 60 * 60);
    const totalHours = Math.round(hours * 100) / 100;
    const overtime =
      totalHours > STANDARD_SHIFT_HOURS
        ? Math.round((totalHours - STANDARD_SHIFT_HOURS) * 100) / 100
        : null;

    setRecords((prev) => [
      {
        id: `ATT-${prev.length + 1}`,
        employeeId: currentUser.employeeId,
        employeeName: currentUser.name,
        date: clockOutTime.toISOString().slice(0, 10),
        clockIn: formatTime(todaysClockIn),
        clockOut: formatTime(clockOutTime),
        totalHours,
        overtimeHours: overtime,
      },
      ...prev,
    ]);
    setClockedIn(false);
    setTodaysClockIn(null);
  }

  const totalHoursThisWeek = records.slice(0, 5).reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  const overtimeCount = records.filter((r) => r.overtimeHours != null).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_4px_12px_rgba(6,182,212,0.3)]">
              <ClockIcon size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Attendance</h1>
          </div>
          <p className="text-sm text-muted ml-10">Clock-in/out records and overtime tracking</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Total Records</p>
              <p className="mt-1.5 text-3xl font-bold text-ink">{records.length}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-md group-hover:scale-110 transition-transform">
              <Calendar size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Hours This Week</p>
              <p className="mt-1.5 text-3xl font-bold text-ink">{totalHoursThisWeek.toFixed(1)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md group-hover:scale-110 transition-transform">
              <Timer size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Overtime Sessions</p>
              <p className="mt-1.5 text-3xl font-bold text-ink">{overtimeCount}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md group-hover:scale-110 transition-transform">
              <TrendingUp size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Clock-in/out status card */}
      <div
        className={`mt-6 flex items-center justify-between rounded-2xl border px-6 py-5 shadow-card transition-all duration-300 animate-fade-in-up ${
          clockedIn
            ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
            : "border-line bg-gradient-to-r from-canvas to-white"
        }`}
        style={{ animationDelay: "0.15s" }}
      >
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 ${
            clockedIn
              ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.4)] animate-pulse-glow"
              : "bg-canvas border border-line text-muted"
          }`}>
            {clockedIn ? <Zap size={20} fill="white" /> : <ClockIcon size={20} />}
          </div>
          <div>
            <p className={`text-sm font-bold ${clockedIn ? "text-emerald-700" : "text-ink"}`}>
              {clockedIn ? "You're clocked in" : "Your status today"}
            </p>
            <p className={`mt-0.5 text-sm ${clockedIn ? "text-emerald-600" : "text-muted"}`}>
              {clockedIn && todaysClockIn
                ? `Clocked in at ${formatTime(todaysClockIn)}`
                : "Not clocked in yet"}
            </p>
          </div>
        </div>
        {clockedIn ? (
          <Button variant="danger" icon={<LogOut size={16} />} onClick={handleClockOut}>
            Clock Out
          </Button>
        ) : (
          <Button variant="success" icon={<ClockIcon size={16} />} onClick={handleClockIn}>
            Clock In
          </Button>
        )}
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <Card>
          <Table>
            <THead>
              <TH>Employee</TH>
              <TH>Date</TH>
              <TH>Clock In</TH>
              <TH>Clock Out</TH>
              <TH>Total Hours</TH>
              <TH>Overtime</TH>
            </THead>
            <TBody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="No attendance records yet." />
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <TR key={rec.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {rec.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-semibold text-ink">{rec.employeeName}</span>
                      </div>
                    </TD>
                    <TD>
                      <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
                        {rec.date}
                      </span>
                    </TD>
                    <TD className="text-sm font-medium text-ink">{rec.clockIn ?? "—"}</TD>
                    <TD className="text-sm font-medium text-ink">{rec.clockOut ?? "—"}</TD>
                    <TD>
                      {rec.totalHours != null ? (
                        <span className="text-sm font-semibold text-ink">{rec.totalHours} hrs</span>
                      ) : "—"}
                    </TD>
                    <TD>
                      {rec.overtimeHours != null ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          +{rec.overtimeHours} hrs
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
