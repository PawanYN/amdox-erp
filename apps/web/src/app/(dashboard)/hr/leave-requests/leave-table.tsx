"use client";

import { Check, X } from "lucide-react";
import { Badge, statusToTone } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { LeaveRequest, UserRole } from "@/lib/types";

export function LeaveTable({
  requests,
  currentUserRole,
  onApprove,
  onReject,
}: {
  requests: LeaveRequest[];
  currentUserRole: UserRole;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const canApprove = currentUserRole === "Manager";

  const columns: ColumnDef<LeaveRequest>[] = [
    {
      header: "Employee",
      cell: (req) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {req.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-semibold text-ink">{req.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Leave Type",
      cell: (req) => (
        <span className="text-xs font-medium text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1">
          {req.leaveType}
        </span>
      ),
    },
    {
      header: "From",
      className: "text-sm text-muted",
      cell: (req) => req.fromDate,
    },
    {
      header: "To",
      className: "text-sm text-muted",
      cell: (req) => req.toDate,
    },
    {
      header: "Days",
      cell: (req) => <span className="text-sm font-bold text-ink">{req.days}d</span>,
    },
    {
      header: "Status",
      cell: (req) => (
        <Badge tone={statusToTone(req.status)}>{req.status}</Badge>
      ),
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
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => onReject(req.id)}
                aria-label={`Reject ${req.employeeName}'s leave request`}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
              >
                <X size={15} />
              </button>
            </div>
          );
        }
        return <span className="text-muted">—</span>;
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
