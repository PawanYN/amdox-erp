"use client";

import { FormEvent, useMemo, useState } from "react";
import { Modal, FormField, inputClasses } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LeaveRequest, LeaveType } from "@/lib/types";
import { currentUser } from "@/lib/current-user";

const LEAVE_TYPES: LeaveType[] = [
  "Sick Leave",
  "Earned Leave",
  "Casual Leave",
  "Unpaid Leave",
];

function calculateDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diff = toDate.getTime() - fromDate.getTime();
  if (diff < 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1; // inclusive of both ends
}

export function LeaveForm({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (request: Omit<LeaveRequest, "id" | "status">) => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const days = useMemo(() => calculateDays(fromDate, toDate), [fromDate, toDate]);

  function reset() {
    setLeaveType(LEAVE_TYPES[0]);
    setFromDate("");
    setToDate("");
    setReason("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO(Task 5 — backend): POST /api/hr/leave-requests with this
    // payload. Server computes `days` authoritatively — see
    // CreateLeaveRequestRequest in lib/api/contracts.ts.
    onCreate({
      employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      leaveType,
      fromDate,
      toDate,
      days,
      reason,
    });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Apply for Leave"
      description="Your manager will be notified once submitted."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Leave type">
          <select
            className={inputClasses}
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="From date">
            <input
              required
              type="date"
              className={inputClasses}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </FormField>
          <FormField label="To date">
            <input
              required
              type="date"
              className={inputClasses}
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
            />
          </FormField>
        </div>

        <div className="rounded-lg bg-canvas px-4 py-3 text-sm">
          <span className="text-muted">Total days: </span>
          <span className="font-semibold text-ink">
            {days > 0 ? days : "—"}
          </span>
        </div>

        <FormField label="Reason">
          <textarea
            required
            rows={3}
            className={inputClasses}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason for leave"
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={days <= 0}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
