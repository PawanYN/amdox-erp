"use client";

import { useState, useEffect } from "react";
import { Clock as ClockIcon, LogOut, Timer, TrendingUp, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { mockAttendance, STANDARD_SHIFT_HOURS } from "@/lib/mock/hr";
import { currentUser } from "@/lib/current-user";
import { useKeycloak } from "@/components/KeycloakProvider";
import { getAuthHeaders } from "@/lib/auth";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AttendancePage() {
  const { token } = useKeycloak();
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    const fetchAttendance = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("http://localhost:3001/attendance/all", { headers });
        if (res.ok) {
          const data = await res.json();
          const formatted = data.map((rec: any) => {
             const cIn = new Date(rec.clockIn);
             const cOut = rec.clockOut ? new Date(rec.clockOut) : null;
             return {
                id: rec.id,
                employeeName: rec.employee?.fullName || "Unknown",
                date: cIn.toISOString().slice(0, 10),
                clockIn: formatTime(cIn),
                clockOut: cOut ? formatTime(cOut) : null,
                totalHours: cOut ? Math.round((cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60) * 10) / 10 : null,
                overtimeHours: rec.overtimeMins ? Math.round((rec.overtimeMins / 60) * 10) / 10 : null
             };
          });
          setRecords(formatted);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAttendance();
  }, [token]);

  const totalHoursThisWeek = records.slice(0, 5).reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  const overtimeCount = records.filter((r) => r.overtimeHours != null).length;

  const columns: ColumnDef<typeof mockAttendance[0]>[] = [
    {
      header: "Employee",
      cell: (rec) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {rec.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-semibold text-ink">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Date",
      cell: (rec) => (
        <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
          {rec.date}
        </span>
      ),
    },
    {
      header: "Clock In",
      className: "text-sm font-medium text-ink",
      cell: (rec) => rec.clockIn ?? "—",
    },
    {
      header: "Clock Out",
      className: "text-sm font-medium text-ink",
      cell: (rec) => rec.clockOut ?? "—",
    },
    {
      header: "Total Hours",
      cell: (rec) => (
        rec.totalHours != null ? (
          <span className="text-sm font-semibold text-ink">{rec.totalHours} hrs</span>
        ) : "—"
      ),
    },
    {
      header: "Overtime",
      cell: (rec) => (
        rec.overtimeHours != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700 shadow-[0_0_8px_rgba(245,158,11,0.15)]">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            +{rec.overtimeHours} hrs
          </span>
        ) : (
          <span className="text-muted">—</span>
        )
      ),
    },
  ];

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



      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <DataTable data={records} columns={columns} keyExtractor={(rec) => rec.id} emptyMessage="No attendance records yet." />
      </div>
    </div>
  );
}
