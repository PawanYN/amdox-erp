"use client";

import { useState, useEffect } from "react";
import { Plus, CalendarDays, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeaveRequest } from "@/lib/types";
import { apiClient } from "@/lib/api/client";
import { currentUser } from "@/lib/current-user";
import { LeaveForm } from "./leave-form";
import { LeaveTable } from "./leave-table";

type RawLeaveRequest = {
  id: string;
  employeeId: string;
  employee?: { fullName?: string };
  leaveType?: { name?: string };
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
};

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      try {
        const data: RawLeaveRequest[] = await apiClient("/leave/all-requests");
        const formatted = data.map((d) => ({
          id: d.id,
          employeeId: d.employeeId,
          employeeName: d.employee?.fullName || "Unknown",
          leaveType: (d.leaveType?.name || "Leave") as LeaveRequest["leaveType"],
          fromDate: new Date(d.startDate).toISOString().split("T")[0],
          toDate: new Date(d.endDate).toISOString().split("T")[0],
          days: Math.max(
            1,
            Math.ceil(
              (new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
          reason: d.reason || "No reason",
          status: (d.status.charAt(0).toUpperCase() +
            d.status.slice(1).toLowerCase()) as LeaveRequest["status"],
        }));
        setRequests(formatted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRequests();
  }, []);

  async function handleCreate(newRequest: Omit<LeaveRequest, "id" | "status">) {
    const leaveTypeMap: Record<string, string> = {
      "Earned Leave": "annual",
      "Casual Leave": "annual",
      "Sick Leave": "sick",
      "Unpaid Leave": "unpaid",
    };

    const payload = {
      employeeId: String(newRequest.employeeId || ""),
      leaveType: String(leaveTypeMap[String(newRequest.leaveType)] || "annual"),
      startDate: String(newRequest.fromDate || ""),
      endDate: String(newRequest.toDate || ""),
      reason: String(newRequest.reason || "No reason provided"),
    };

    try {
      const res = await apiClient("/leave", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = res.data || res;
      setRequests((prev) => [
        {
          ...newRequest,
          id: created.id || `LR-${String(prev.length + 1).padStart(3, "0")}`,
          status: created.status || "Pending",
        },
        ...prev,
      ]);
      setFormOpen(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create leave request.";
      alert(`Error: ${errMsg}`);
    }
  }

  async function handleApprove(id: string) {
    try {
      await apiClient(`/leave/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", managerEmployeeId: currentUser.employeeId }),
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r)));
    } catch (err) {
      alert(`Error approving leave: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  async function handleReject(id: string) {
    try {
      await apiClient(`/leave/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected", managerEmployeeId: currentUser.employeeId }),
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Rejected" } : r)));
    } catch (err) {
      alert(`Error rejecting leave: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const pending = requests.filter((r) => r.status === "Pending").length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const rejected = requests.filter((r) => r.status === "Rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <CalendarDays size={18} className="text-slate-500" />
            Leave Requests
          </h1>
          <p className="page-subtitle mt-1">Approval workflow for employee leave applications</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          Apply for Leave
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            Total
          </p>
          <p className="text-2xl font-semibold text-slate-900">{requests.length}</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 mb-1.5">
            Pending
          </p>
          <p className="text-2xl font-semibold text-amber-700">{pending}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">
            Approved
          </p>
          <p className="text-2xl font-semibold text-emerald-700">{approved}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-1.5">
            Rejected
          </p>
          <p className="text-2xl font-semibold text-red-600">{rejected}</p>
        </div>
      </div>

      <LeaveTable
        requests={requests}
        currentUserRole={currentUser.role}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <LeaveForm open={formOpen} onClose={() => setFormOpen(false)} onCreate={handleCreate} />
    </div>
  );
}
