"use client";

import { Check, X } from "lucide-react";
import { Badge, statusToTone } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { LeaveRequest } from "@/lib/types/hr";

export function LeaveTable({
  requests,
  canApprove,
  onApprove,
  onReject,
}: {
  requests: LeaveRequest[];
  canApprove: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const columns: ColumnDef<LeaveRequest>[] = [
    {
      header: "Employee",
      cell: (req) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {req.employeeName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span className="font-semibold text-slate-900">{req.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Leave Type",
      cell: (req) => (
        <span className="text-[12px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
          {req.leaveType}
        </span>
      ),
    },
    {
      header: "From",
      className: "text-sm text-slate-500",
      cell: (req) => req.fromDate,
    },
    {
      header: "To",
      className: "text-sm text-slate-500",
      cell: (req) => req.toDate,
    },
    {
      header: "Days",
      cell: (req) => <span className="text-sm font-bold text-slate-900">{req.days}d</span>,
    },
    {
      header: "Status",
      cell: (req) => <Badge tone={statusToTone(req.status)}>{req.status}</Badge>,
    },
  ];

  if (canApprove) {
    columns.push({
      header: "Action",
      cell: (req) => {
        if (req.status === "Pending") {
          return (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(req.id)}
                aria-label={`Approve ${req.employeeName}'s leave request`}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-colors"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => onReject(req.id)}
                aria-label={`Reject ${req.employeeName}'s leave request`}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        }
        return <span className="text-slate-300">—</span>;
      },
    });
  }

  return (
    <DataTable
      data={requests}
      columns={columns}
      keyExtractor={(req) => req.id}
      emptyMessage="No leave requests yet."
    />
  );
}
