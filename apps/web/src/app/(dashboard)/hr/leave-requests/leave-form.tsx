"use client";

import { FormEvent, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/ui/form-row";
import { LeaveRequest, LeaveType } from "@/lib/types/hr";

const LEAVE_TYPES: LeaveType[] = ["Sick Leave", "Earned Leave", "Casual Leave", "Unpaid Leave"];

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
  employeeId,
  employeeName,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (request: Omit<LeaveRequest, "id" | "status">) => void;
  employeeId: string;
  employeeName: string;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType>(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");

  const days = useMemo(() => calculateDays(fromDate, toDate), [fromDate, toDate]);
  const canSubmit = Boolean(employeeId) && days > 0;

  function reset() {
    setLeaveType(LEAVE_TYPES[0]);
    setFromDate("");
    setToDate("");
    setReason("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) return;
    onCreate({
      employeeId,
      employeeName: employeeName || "Unknown",
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
        {!employeeId && (
          <div style={{
            borderRadius: "6px",
            border: "1px solid #fee2e2",
            backgroundColor: "#fef2f2",
            padding: "10px 12px",
            fontSize: "13px",
            color: "#dc2626"
          }}>
            Employee profile not loaded. Close and try again after your session is ready.
          </div>
        )}

        <FormRow label="Leave type" required>
          <FormSelect
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FormSelect>
        </FormRow>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <FormRow label="From date" required>
            <FormInput
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="To date" required>
            <FormInput
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </FormRow>
        </div>

        <div style={{
          borderRadius: "6px",
          backgroundColor: "#f4f6f8",
          padding: "12px 16px",
          fontSize: "13px"
        }}>
          <span style={{ color: "#6b7280" }}>Total days: </span>
          <span style={{ fontWeight: 600, color: "#2b2f36" }}>{days > 0 ? days : "—"}</span>
        </div>

        <FormRow label="Reason" required>
          <FormTextarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason for leave"
            rows={3}
          />
        </FormRow>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "8px" }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
