"use client";

import { useState, useEffect } from "react";
import { Clock as ClockIcon, Timer, TrendingUp, Calendar } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { useKeycloak } from "@/components/KeycloakProvider";
import { hrApi } from "@/lib/api/hr-api";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type RawAttendance = {
  id: string;
  employee?: { fullName?: string };
  clockIn: string;
  clockOut?: string | null;
  overtimeMins?: number | null;
};

type AttendanceRow = {
  id: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  overtimeHours: number | null;
};

export default function AttendancePage() {
  const { token } = useKeycloak();
  const [records, setRecords] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    if (!token) return;
    const fetchAttendance = async () => {
      try {
        const data: RawAttendance[] = await hrApi.getAllAttendance();
        const formatted = data.map((rec) => {
          const cIn = new Date(rec.clockIn);
          const cOut = rec.clockOut ? new Date(rec.clockOut) : null;
          return {
            id: rec.id,
            employeeName: rec.employee?.fullName || "Unknown",
            date: cIn.toISOString().slice(0, 10),
            clockIn: formatTime(cIn),
            clockOut: cOut ? formatTime(cOut) : null,
            totalHours: cOut
              ? Math.round(((cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60)) * 10) / 10
              : null,
            overtimeHours: rec.overtimeMins ? Math.round((rec.overtimeMins / 60) * 10) / 10 : null,
          };
        });
        setRecords(formatted);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAttendance();
  }, [token]);

  const totalHoursThisWeek = records.slice(0, 5).reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  const overtimeCount = records.filter((r) => r.overtimeHours != null).length;

  const columns: ColumnDef<(typeof records)[0]>[] = [
    {
      header: "Employee",
      cell: (rec) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {rec.employeeName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span className="font-semibold text-slate-900">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Date",
      cell: (rec) => (
        <span className="text-[12px] font-medium text-slate-600 bg-slate-100 rounded px-2 py-0.5">
          {rec.date}
        </span>
      ),
    },
    {
      header: "Clock In",
      className: "text-sm font-medium text-slate-700",
      cell: (rec) => rec.clockIn ?? "—",
    },
    {
      header: "Clock Out",
      className: "text-sm font-medium text-slate-700",
      cell: (rec) => rec.clockOut ?? <span className="text-slate-300">—</span>,
    },
    {
      header: "Total Hours",
      cell: (rec) =>
        rec.totalHours != null ? (
          <span className="text-sm font-semibold text-slate-900">{rec.totalHours} hrs</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      header: "Overtime",
      cell: (rec) =>
        rec.overtimeHours != null ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />+{rec.overtimeHours} hrs
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ClockIcon size={18} className="text-slate-400" />
          Attendance
        </h1>
        <p className="page-subtitle mt-1">Clock-in/out records and overtime tracking</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
            Total Records
          </p>
          <p className="text-2xl font-semibold text-slate-900">{records.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
            Hours This Week
          </p>
          <p className="text-2xl font-semibold text-slate-900">{totalHoursThisWeek.toFixed(1)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 mb-1.5">
            Overtime Sessions
          </p>
          <p className="text-2xl font-semibold text-amber-700">{overtimeCount}</p>
        </div>
      </div>

      <DataTable
        data={records}
        columns={columns}
        keyExtractor={(rec) => rec.id}
        emptyMessage="No attendance records yet."
      />
    </div>
  );
}
