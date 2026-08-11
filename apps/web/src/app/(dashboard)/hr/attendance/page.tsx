"use client";

import { useState, useEffect } from "react";
import { Clock as ClockIcon } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { useKeycloak } from "@/components/layout/keycloak-provider";
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

  useEffect(() => {
    if (!token) return;
    fetchAttendance();
  }, [token]);

  const totalHoursThisWeek = records.slice(0, 5).reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  const overtimeCount = records.filter((r) => r.overtimeHours != null).length;

  const columns: ColumnDef<(typeof records)[0]>[] = [
    {
      header: "Employee",
      cell: (rec) => (
        <div className="flex items-center gap-2.5">
          <div style={{background: '#1f5fa8'}} className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {rec.employeeName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span style={{color: '#2b2f36'}} className="font-semibold">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Date",
      cell: (rec) => (
        <span style={{color: '#2b2f36', background: '#f7f9fb', border: '1px solid #dfe3e8'}} className="text-[12px] font-medium rounded px-2 py-0.5">
          {rec.date}
        </span>
      ),
    },
    {
      header: "Clock In",
      className: "text-sm font-medium",
      cell: (rec) => <span style={{color: '#2b2f36'}}>{rec.clockIn ?? "—"}</span>,
    },
    {
      header: "Clock Out",
      className: "text-sm font-medium",
      cell: (rec) => <span style={{color: rec.clockOut ? '#2b2f36' : '#d1d5db'}}>{rec.clockOut ?? "—"}</span>,
    },
    {
      header: "Total Hours",
      cell: (rec) =>
        rec.totalHours != null ? (
          <span style={{color: '#2b2f36'}} className="text-sm font-semibold">{rec.totalHours} hrs</span>
        ) : (
          <span style={{color: '#d1d5db'}}>—</span>
        ),
    },
    {
      header: "Overtime",
      cell: (rec) =>
        rec.overtimeHours != null ? (
          <span style={{background: '#fef3c7', borderColor: '#fcd34d', color: '#b45309'}} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
            <span style={{background: '#f59e0b'}} className="h-1.5 w-1.5 rounded-full" />+{rec.overtimeHours} hrs
          </span>
        ) : (
          <span style={{color: '#d1d5db'}}>—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ClockIcon size={18} style={{color: '#6b7280'}} />
          Attendance
        </h1>
        <p className="page-subtitle mt-1" style={{color: '#6b7280'}}>
          Organization-wide attendance records and overtime tracking
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div style={{background: '#ffffff', borderColor: '#dfe3e8'}} className="rounded-lg border shadow-card p-5">
          <p style={{color: '#6b7280'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Total Records
          </p>
          <p style={{color: '#2b2f36'}} className="text-2xl font-semibold">{records.length}</p>
        </div>
        <div style={{background: '#ffffff', borderColor: '#dfe3e8'}} className="rounded-lg border shadow-card p-5">
          <p style={{color: '#6b7280'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Hours This Week
          </p>
          <p style={{color: '#2b2f36'}} className="text-2xl font-semibold">{totalHoursThisWeek.toFixed(1)}</p>
        </div>
        <div style={{background: '#fef3c7', borderColor: '#fcd34d'}} className="rounded-lg border p-5">
          <p style={{color: '#92400e'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Overtime Sessions
          </p>
          <p style={{color: '#b45309'}} className="text-2xl font-semibold">{overtimeCount}</p>
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
