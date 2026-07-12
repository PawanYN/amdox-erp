"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { CalendarDays } from "lucide-react";
import { LeaveRequest } from "@/lib/types";
import { useKeycloak } from "@/components/KeycloakProvider";
import { hrApi } from "@/lib/api/hr-api";
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

type MeProfile = {
  id: string;
  fullName?: string;
};

function formatLeaveRequests(data: RawLeaveRequest[]): LeaveRequest[] {
  return data.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    employeeName: d.employee?.fullName || "Unknown",
    leaveType: (d.leaveType?.name || "Leave") as LeaveRequest["leaveType"],
    fromDate: new Date(d.startDate).toISOString().split("T")[0],
    toDate: new Date(d.endDate).toISOString().split("T")[0],
    days: Math.max(
      1,
      Math.ceil(
        (new Date(d.endDate).getTime() - new Date(d.startDate).getTime()) / (1000 * 60 * 60 * 24),
      ),
    ),
    reason: d.reason || "No reason",
    status: (d.status.charAt(0).toUpperCase() +
      d.status.slice(1).toLowerCase()) as LeaveRequest["status"],
  }));
}

function rolesFromToken(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.realm_access?.roles || [];
  } catch {
    return [];
  }
}

function canApproveLeave(roles: string[]): boolean {
  const normalized = roles.map((r) => r.toLowerCase().replace(/\s+/g, "_"));
  return (
    normalized.includes("manager") ||
    normalized.includes("tenant_admin") ||
    normalized.includes("tenantadmin") ||
    normalized.includes("superadmin")
  );
}

export default function LeaveRequestsPage() {
  const { token } = useKeycloak();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const roles = rolesFromToken(token);
  const canApprove = canApproveLeave(roles);

  useEffect(() => {
    if (!token) return;

    async function load() {
      setLoading(true);
      setProfileError(null);
      setListError(null);

      try {
        const me = await hrApi.getMe();
        if (!me?.id) {
          setProfileError("Could not resolve your employee profile.");
        } else {
          setProfile({ id: me.id, fullName: me.fullName });
        }
      } catch (err) {
        setProfileError(
          err instanceof Error ? err.message : "Failed to load your employee profile.",
        );
      }

      try {
        const data: RawLeaveRequest[] = await hrApi.getAllLeaveRequests();
        setRequests(formatLeaveRequests(data));
      } catch (err) {
        console.error(err);
        setListError(err instanceof Error ? err.message : "Failed to load leave requests.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  async function handleApprove(id: string) {
    if (!profile?.id) {
      toast("Your employee profile is not loaded. Cannot approve leave.", "error");
      return;
    }
    try {
      await hrApi.approveLeaveRequest(id, {
        status: "approved",
        managerEmployeeId: profile.id,
      });
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Approved" } : r)));
    } catch (err) {
      toast(
        `Error approving leave: ${err instanceof Error ? err.message : "unknown error"}`,
        "error",
      );
    }
  }

  async function handleReject(id: string) {
    if (!profile?.id) {
      toast("Your employee profile is not loaded. Cannot reject leave.", "error");
      return;
    }
    try {
      await hrApi.rejectLeaveRequest(id, profile.id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Rejected" } : r)));
    } catch (err) {
      toast(
        `Error rejecting leave: ${err instanceof Error ? err.message : "unknown error"}`,
        "error",
      );
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
      </div>

      {profileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {profileError}
        </div>
      )}
      {listError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {listError}
        </div>
      )}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Loading leave requests…
        </div>
      )}

      {!loading && (
        <>
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
            canApprove={canApprove && !!profile?.id}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </>
      )}
    </div>
  );
}
