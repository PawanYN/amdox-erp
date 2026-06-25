"use client";

import { useState } from "react";
import { Plus, Users, UserCheck, UserMinus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { mockEmployees } from "@/lib/mock/employees";
import { Employee } from "@/lib/types";
import { EmployeeForm } from "./employee-form";
import { OrgChart } from "./org-chart";

type ViewMode = "list" | "org-chart";

function StatCard({
  label,
  value,
  icon,
  gradient,
  delay = "0s",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  delay?: string;
}) {
  return (
    <div
      className="animate-fade-in-up rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 group"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted/70">{label}</p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [view, setView] = useState<ViewMode>("list");
  const [formOpen, setFormOpen] = useState(false);

  const potentialManagers = employees;
  const visibleEmployees = employees.filter((e) => e.id !== "EMP-100");
  const activeCount = visibleEmployees.filter((e) => e.status === "Active").length;
  const inactiveCount = visibleEmployees.filter((e) => e.status !== "Active").length;

  function handleCreate(newEmployee: Omit<Employee, "id" | "status">) {
    const id = `EMP-${100 + employees.length + 1}`;
    setEmployees((prev) => [
      ...prev,
      { ...newEmployee, id, status: "Active" },
    ]);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(108,71,255,0.3)]">
              <Users size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Employees</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Personal info, contracts, department &amp; reporting hierarchy
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          New Employee
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Employees" value={visibleEmployees.length} icon={<Users size={18} />} gradient="from-violet-500 to-purple-600" delay="0.05s" />
        <StatCard label="Active" value={activeCount} icon={<UserCheck size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Inactive" value={inactiveCount} icon={<UserMinus size={18} />} gradient="from-rose-400 to-pink-500" delay="0.15s" />
        <StatCard label="Departments" value={new Set(visibleEmployees.map(e => e.department)).size} icon={<TrendingUp size={18} />} gradient="from-cyan-400 to-blue-500" delay="0.20s" />
      </div>

      {/* View toggle */}
      <div className="mt-6 inline-flex rounded-xl bg-white border border-line p-1 shadow-sm animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
        <button
          onClick={() => setView("list")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
            view === "list"
              ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-[0_2px_8px_rgba(108,71,255,0.35)]"
              : "text-muted hover:text-ink"
          }`}
        >
          List View
        </button>
        <button
          onClick={() => setView("org-chart")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 ${
            view === "org-chart"
              ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-[0_2px_8px_rgba(108,71,255,0.35)]"
              : "text-muted hover:text-ink"
          }`}
        >
          Org Chart
        </button>
      </div>

      <div className="mt-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
        {view === "list" ? (
          <Card>
            <Table>
              <THead>
                <TH>ID</TH>
                <TH>Name</TH>
                <TH>Department</TH>
                <TH>Designation</TH>
                <TH>Reports To</TH>
                <TH>Status</TH>
              </THead>
              <TBody>
                {visibleEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState message="No employees yet. Add the first one to get started." />
                    </td>
                  </tr>
                ) : (
                  visibleEmployees.map((emp) => {
                    const manager = employees.find((e) => e.id === emp.reportsToId);
                    return (
                      <TR key={emp.id}>
                        <TD>
                          <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
                            {emp.id}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                              {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                            <span className="font-semibold text-ink">{emp.name}</span>
                          </div>
                        </TD>
                        <TD>
                          <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
                            {emp.department}
                          </span>
                        </TD>
                        <TD className="text-muted text-sm">{emp.designation}</TD>
                        <TD className="text-muted text-sm">{manager?.name ?? "—"}</TD>
                        <TD>
                          <Badge tone={statusToTone(emp.status)}>{emp.status}</Badge>
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <OrgChart employees={employees} />
          </Card>
        )}
      </div>

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        managers={potentialManagers}
        onCreate={handleCreate}
      />
    </div>
  );
}
