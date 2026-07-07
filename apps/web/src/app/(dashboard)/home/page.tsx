"use client";

import { useKeycloak } from "@/components/KeycloakProvider";
import { User, Shield, Calendar, Clock, Zap, LogOut, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { hrApi } from "@/lib/api/hr-api";

type Profile = {
  id: string;
  fullName?: string;
  email?: string;
  department?: { name?: string };
  manager?: { fullName?: string };
};
type LeaveBalance = { leaveType: { id: string; name: string }; balanceDays: number };
type LeaveRequest = {
  id: string;
  leaveType?: { name: string };
  startDate: string;
  endDate: string;
  status: string;
};

export default function DashboardHome() {
  const { token } = useKeycloak();
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);
  const [todaysClockIn, setTodaysClockIn] = useState<Date | null>(null);

  let name = "Loading…";
  let email = "Loading…";
  let role = "Employee";
  let isAdmin = false;

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      name = payload.name || payload.preferred_username || "Unknown";
      email = payload.email || "Unknown";
      const roles = payload.realm_access?.roles || [];
      if (roles.includes("tenant_admin") || roles.includes("TENANT_ADMIN")) {
        role = "Tenant Admin";
        isAdmin = true;
      } else if (roles.includes("manager") || roles.includes("MANAGER")) role = "Manager";
    } catch {}
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      let prof: Profile | null = null;
      try {
        prof = await hrApi.getMe();
        setProfile(prof);
      } catch {}
      if (!prof?.id) return;
      try {
        const status = await hrApi.getAttendanceStatus(prof.id);
        setClockedIn(status.clockedIn);
        if (status.record?.clockIn) setTodaysClockIn(new Date(status.record.clockIn));
        const b = await hrApi.getMyLeaveBalances(prof.id);
        setBalances(b);
        if (b.length > 0) setLeaveType(b[0].leaveType.name);
        setRequests(await hrApi.getMyLeaveRequests(prof.id));
      } catch {}
    })();
  }, [token]);

  const handleClockIn = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockIn(profile.id);
      setClockedIn(true);
      setTodaysClockIn(new Date());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockOut(profile.id);
      setClockedIn(false);
      setTodaysClockIn(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to clock out");
    }
  };

  const submitLeave = async () => {
    if (!profile?.id || !leaveType || !startDate || !endDate) return;
    setIsSubmitting(true);
    try {
      await hrApi.createLeaveRequest({
        employeeId: profile.id,
        leaveType: leaveType.toLowerCase().includes("sick") ? "sick" : "annual",
        startDate,
        endDate,
        reason: reason || "Leave requested from dashboard",
      });
      setShowLeaveForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      setRequests(await hrApi.getMyLeaveRequests(profile.id));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const annualBalance =
    balances.find((b) => b.leaveType?.name === "Annual Leave")?.balanceDays || 0;
  const sickBalance = balances.find((b) => b.leaveType?.name === "Sick Leave")?.balanceDays || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-semibold shrink-0">
          {(profile?.fullName || name)
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 truncate">
            {profile?.fullName || name}
          </h1>
          <p className="text-[13px] text-slate-500 truncate">{profile?.email || email}</p>
        </div>
        <div className="ml-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Shield size={12} />
            {role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Profile details */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Profile Details
            </p>
            <div className="space-y-3">
              {[
                ["Department", isAdmin ? "Administration" : profile?.department?.name || "—"],
                ["Manager", isAdmin ? "—" : profile?.manager?.fullName || "—"],
                ["Access", isAdmin ? "Full Access" : "Employee Access"],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">
                    {label}
                  </p>
                  <p className="text-[13px] text-slate-800 font-medium mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Clock in/out */}
          {!isAdmin && (
            <div
              className={`rounded-lg border p-5 transition-all duration-300 ${
                clockedIn
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-white shadow-card"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    clockedIn ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {clockedIn ? <Zap size={16} fill="white" /> : <Clock size={16} />}
                </div>
                <div>
                  <p
                    className={`text-[13px] font-semibold ${clockedIn ? "text-emerald-800" : "text-slate-900"}`}
                  >
                    {clockedIn ? "Clocked In" : "Not clocked in"}
                  </p>
                  <p className={`text-[11px] ${clockedIn ? "text-emerald-600" : "text-slate-500"}`}>
                    {clockedIn && todaysClockIn
                      ? `Since ${todaysClockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Ready to start your day?"}
                  </p>
                </div>
              </div>
              {clockedIn ? (
                <button
                  onClick={handleClockOut}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white text-red-600 border border-red-200 text-[12px] font-semibold rounded-md hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} /> Clock Out
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-700 text-white text-[12px] font-semibold rounded-md hover:bg-emerald-800 transition-colors"
                >
                  <Clock size={13} /> Clock In
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right columns */}
        {!isAdmin && (
          <div className="col-span-2 space-y-5">
            {/* Leave balance cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar size={13} className="text-slate-500" />
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Annual Leave
                  </p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{annualBalance}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">days remaining</p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={13} className="text-slate-500" />
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Sick Leave
                  </p>
                </div>
                <p className="text-3xl font-bold text-slate-900">{sickBalance}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">days remaining</p>
              </div>
            </div>

            {/* Leave requests */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[13px] font-semibold text-slate-900">Recent Leave Requests</p>
                <button
                  onClick={() => setShowLeaveForm(!showLeaveForm)}
                  className="text-[12px] font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                >
                  {showLeaveForm ? "Cancel" : "Apply for Leave"}
                </button>
              </div>

              {showLeaveForm ? (
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3 animate-fade-in-up">
                  <p className="text-[12px] font-semibold text-slate-700">New Leave Application</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                        Leave Type
                      </label>
                      <select
                        className="input-base"
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
                      >
                        {balances.map((b) => (
                          <option key={b.leaveType.id} value={b.leaveType.name}>
                            {b.leaveType.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="input-base"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        className="input-base"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[11px] text-slate-500 font-medium uppercase mb-1">
                        Reason (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Brief reason…"
                        className="input-base"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    onClick={submitLeave}
                    disabled={isSubmitting || !startDate || !endDate || !leaveType}
                    className="w-full py-2 bg-slate-900 text-white text-[12px] font-semibold rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {requests.length === 0 ? (
                    <p className="text-[13px] text-slate-500 italic">No leave requests found.</p>
                  ) : (
                    requests.slice(0, 5).map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-md border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">
                            {req.leaveType?.name || "Leave"}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(req.startDate).toLocaleDateString()} –{" "}
                            {new Date(req.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            req.status === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : req.status === "REJECTED"
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
