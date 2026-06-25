"use client";

import { Check, X } from "lucide-react";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { Badge, statusToTone } from "@/components/ui/badge";
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

  return (
    <Card>
      <Table>
        <THead>
          <TH>Employee</TH>
          <TH>Leave Type</TH>
          <TH>From</TH>
          <TH>To</TH>
          <TH>Days</TH>
          <TH>Status</TH>
          {canApprove && <TH>Action</TH>}
        </THead>
        <TBody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan={canApprove ? 7 : 6}>
                <EmptyState message="No leave requests yet." />
              </td>
            </tr>
          ) : (
            requests.map((req) => (
              <TR key={req.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {req.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="font-semibold text-ink">{req.employeeName}</span>
                  </div>
                </TD>
                <TD>
                  <span className="text-xs font-medium text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1">
                    {req.leaveType}
                  </span>
                </TD>
                <TD className="text-sm text-muted">{req.fromDate}</TD>
                <TD className="text-sm text-muted">{req.toDate}</TD>
                <TD>
                  <span className="text-sm font-bold text-ink">{req.days}d</span>
                </TD>
                <TD>
                  <Badge tone={statusToTone(req.status)}>{req.status}</Badge>
                </TD>
                {canApprove && (
                  <TD>
                    {req.status === "Pending" ? (
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
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                )}
              </TR>
            ))
          )}
        </TBody>
      </Table>
    </Card>
  );
}
