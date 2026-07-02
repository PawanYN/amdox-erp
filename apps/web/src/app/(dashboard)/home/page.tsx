"use client";

import { useKeycloak } from "@/components/KeycloakProvider";
import { User, Shield, Calendar, Clock, Zap, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { hrApi } from "@/lib/api/hr-api";

export default function DashboardHome() {
  const { token } = useKeycloak();
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [balances, setBalances] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [clockedIn, setClockedIn] = useState(false);
  const [todaysClockIn, setTodaysClockIn] = useState<Date | null>(null);

  let name = "Loading...";
  let email = "Loading...";
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
      } else if (roles.includes("manager") || roles.includes("MANAGER")) {
        role = "Manager";
      }
    } catch (e) {
      console.error("Failed to parse token", e);
    }
  }

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      let profData: any = null;
      try {
        profData = await hrApi.getMe();
        setProfile(profData);
      } catch (error: any) {
        if (!error?.message?.includes("Employee profile not found")) {
          console.error("Failed to fetch employee profile:", error);
        }
      }

      if (!profData?.id) return;

      try {
        const status = await hrApi.getAttendanceStatus(profData.id);
        setClockedIn(status.clockedIn);
        if (status.record?.clockIn) {
          setTodaysClockIn(new Date(status.record.clockIn));
        }

        const b = await hrApi.getMyLeaveBalances(profData.id);
        setBalances(b);
        if (b.length > 0) setLeaveType(b[0].leaveType.name);

        setRequests(await hrApi.getMyLeaveRequests(profData.id));
      } catch (error) {
        console.error("Failed to fetch HR dashboard data:", error);
      }
    };
    fetchData();
  }, [token]);

  const handleClockIn = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockIn(profile.id);
      setClockedIn(true);
      setTodaysClockIn(new Date());
    } catch (e: any) {
      alert(e.message || "Failed to clock in");
    }
  };

  const handleClockOut = async () => {
    if (!profile?.id) return;
    try {
      await hrApi.clockOut(profile.id);
      setClockedIn(false);
      setTodaysClockIn(null);
    } catch (e: any) {
      alert(e.message || "Failed to clock out");
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
        reason: reason || "Leave requested from quick-apply widget",
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

  const annualBalance = balances.find((b) => b.leaveType?.name === "Annual Leave")?.balanceDays || 0;
  const sickBalance = balances.find((b) => b.leaveType?.name === "Sick Leave")?.balanceDays || 0;

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="flex items-center gap-4 border-b border-line pb-6">
        <div className="h-16 w-16 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
          <User size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">{profile?.fullName || name}</h1>
          <p className="text-muted text-sm mt-0.5">{profile?.email || email}</p>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-purple/5 border border-brand-purple/20 rounded-full">
            <Shield size={14} className="text-brand-purple" />
            <span className="text-xs font-semibold text-brand-purple uppercase tracking-wider">{role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <div className="border border-line rounded-xl p-5 bg-white shadow-sm">
            <h2 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
              Profile Details
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">Department</p>
                <p className="text-sm text-ink font-medium mt-0.5">
                  {isAdmin ? "Administration" : (profile?.department?.name || "N/A")}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">Manager</p>
                <p className="text-sm text-ink font-medium mt-0.5">
                  {isAdmin ? "N/A" : (profile?.manager?.fullName || "N/A")}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">System Access</p>
                <p className="text-sm text-ink font-medium mt-0.5">
                  {isAdmin ? "Full Access" : "Restricted (Employee)"}
                </p>
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div
              className={`flex flex-col rounded-xl border p-5 shadow-sm transition-all duration-300 ${
                clockedIn
                  ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
                  : "border-line bg-gradient-to-r from-canvas to-white"
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  clockedIn
                    ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-sm"
                    : "bg-canvas border border-line text-muted"
                }`}>
                  {clockedIn ? <Zap size={18} fill="white" /> : <Clock size={18} />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${clockedIn ? "text-emerald-700" : "text-ink"}`}>
                    {clockedIn ? "You're clocked in" : "Ready to work?"}
                  </p>
                  <p className={`text-xs ${clockedIn ? "text-emerald-600" : "text-muted"}`}>
                    {clockedIn && todaysClockIn
                      ? `Clocked in at ${todaysClockIn.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Not clocked in yet"}
                  </p>
                </div>
              </div>
              {clockedIn ? (
                <button
                  onClick={handleClockOut}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold rounded hover:bg-rose-100 transition-colors"
                >
                  <LogOut size={14} /> Clock Out
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded hover:bg-emerald-100 transition-colors"
                >
                  <Clock size={14} /> Clock In
                </button>
              )}
            </div>
          )}
        </div>

        {!isAdmin && (
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-line rounded-xl p-5 bg-white shadow-sm flex flex-col justify-center">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} /> Annual Leave Balance
                </p>
                <p className="text-3xl font-bold text-ink mt-2">{annualBalance} <span className="text-sm font-medium text-muted">days</span></p>
              </div>
              <div className="border border-line rounded-xl p-5 bg-white shadow-sm flex flex-col justify-center">
                <p className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} /> Sick Leave Balance
                </p>
                <p className="text-3xl font-bold text-ink mt-2">{sickBalance} <span className="text-sm font-medium text-muted">days</span></p>
              </div>
            </div>

            <div className="border border-line rounded-xl p-5 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-ink">Recent Leave Requests</h2>
                <button
                  onClick={() => setShowLeaveForm(!showLeaveForm)}
                  className="text-xs font-semibold text-white bg-brand-purple px-3 py-1.5 rounded-lg hover:bg-brand-purple/90 transition-colors"
                >
                  {showLeaveForm ? "Cancel" : "Apply for Leave"}
                </button>
              </div>

              {showLeaveForm ? (
                <div className="bg-canvas/50 p-4 rounded-lg border border-line mb-4 animate-in fade-in slide-in-from-top-2">
                  <h3 className="text-xs font-semibold text-ink mb-3">New Leave Application</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted font-semibold uppercase">Leave Type</label>
                      <select
                        className="w-full text-sm border border-line rounded p-1.5 mt-1 bg-white"
                        value={leaveType}
                        onChange={(e) => setLeaveType(e.target.value)}
                      >
                        {balances.map((b) => (
                          <option key={b.leaveType.id} value={b.leaveType.name}>{b.leaveType.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted font-semibold uppercase">Start Date</label>
                      <input
                        type="date"
                        className="w-full text-sm border border-line rounded p-1.5 mt-1 bg-white"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted font-semibold uppercase">End Date</label>
                      <input
                        type="date"
                        className="w-full text-sm border border-line rounded p-1.5 mt-1 bg-white"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted font-semibold uppercase">Reason</label>
                      <input
                        type="text"
                        placeholder="Brief reason (optional)"
                        className="w-full text-sm border border-line rounded p-1.5 mt-1 bg-white"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    onClick={submitLeave}
                    disabled={isSubmitting || !startDate || !endDate || !leaveType}
                    className="w-full py-2 bg-ink text-white text-xs font-semibold rounded hover:bg-ink/90 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.length === 0 ? (
                    <p className="text-sm text-muted italic">No leave requests found.</p>
                  ) : (
                    requests.slice(0, 5).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-line hover:border-brand-purple/30 transition-colors bg-canvas/30">
                        <div>
                          <p className="text-sm font-semibold text-ink">{req.leaveType?.name || "Leave"}</p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
                          req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                          req.status === "REJECTED" ? "bg-rose-100 text-rose-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
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
