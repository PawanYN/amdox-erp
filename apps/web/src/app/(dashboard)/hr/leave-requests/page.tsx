"use client";

import { useState } from "react";
import { Plus, CalendarDays, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockLeaveRequests } from "@/lib/mock/leave-requests";
import { LeaveRequest } from "@/lib/types";
import { currentUser } from "@/lib/current-user";
import { LeaveForm } from "./leave-form";
import { LeaveTable } from "./leave-table";

export default function LeaveRequestsPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [formOpen, setFormOpen] = useState(false);

  function handleCreate(newRequest: Omit<LeaveRequest, "id" | "status">) {
    const id = `LR-${String(requests.length + 1).padStart(3, "0")}`;
    setRequests((prev) => [{ ...newRequest, id, status: "Pending" }, ...prev]);
  }

  function handleApprove(id: string) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r)));
  }

  function handleReject(id: string) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Rejected" } : r)));
  }

  const pending = requests.filter((r) => r.status === "Pending").length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const rejected = requests.filter((r) => r.status === "Rejected").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-[0_4px_12px_rgba(236,72,153,0.3)]">
              <CalendarDays size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Leave Requests</h1>
          </div>
          <p className="text-sm text-muted ml-10">Approval workflow for employee leave applications</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          Apply for Leave
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Total</p>
              <p className="mt-1.5 text-3xl font-bold text-ink">{requests.length}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md group-hover:scale-110 transition-transform">
              <CalendarDays size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600/70">Pending</p>
              <p className="mt-1.5 text-3xl font-bold text-amber-700">{pending}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-md group-hover:scale-110 transition-transform">
              <Clock size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600/70">Approved</p>
              <p className="mt-1.5 text-3xl font-bold text-emerald-700">{approved}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md group-hover:scale-110 transition-transform">
              <CheckCircle size={18} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-500/70">Rejected</p>
              <p className="mt-1.5 text-3xl font-bold text-red-600">{rejected}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-md group-hover:scale-110 transition-transform">
              <XCircle size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <LeaveTable
          requests={requests}
          currentUserRole={currentUser.role}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>

      <LeaveForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
