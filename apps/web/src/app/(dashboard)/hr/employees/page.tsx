"use client";

import { useEffect, useState } from "react";
import { Plus, Users, UserCheck, UserMinus, TrendingUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Employee, NewEmployeeInput } from "@/lib/types";
import { useKeycloak } from "@/components/KeycloakProvider";
import { hrApi } from "@/lib/api/hr-api";
import { EmployeeForm } from "./employee-form";
import { OrgChart } from "./org-chart";

type ViewMode = "list" | "org-chart";

function mapEmployee(emp: any): Employee {
  return {
    id: emp.id,
    name: emp.fullName,
    email: emp.email,
    phone: emp.phone || "",
    department: emp.department?.name || "No Department",
    departmentId: emp.departmentId || emp.department?.id || "",
    designation: emp.designation || "",
    contractType: (emp.contractType || "Full-time") as Employee["contractType"],
    startDate: emp.hireDate ? new Date(emp.hireDate).toISOString().split("T")[0] : "",
    reportsToId: emp.managerId || null,
    status: (emp.status || "ACTIVE") === "ACTIVE" ? "Active" : "Inactive",
    dateOfBirth: emp.dateOfBirth
      ? new Date(emp.dateOfBirth).toISOString().split("T")[0]
      : undefined,
  };
}

export default function EmployeesPage() {
  const { token, initialized } = useKeycloak();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = async () => {
    if (!token) return;
    try {
      const data = await hrApi.getEmployees();
      setEmployees(data.map(mapEmployee));
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const fetchDepartments = async () => {
    if (!token) return;
    try {
      setDepartments(await hrApi.getDepartments());
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    }
  };

  useEffect(() => {
    if (initialized && token) {
      fetchEmployees();
      fetchDepartments();
    }
  }, [initialized, token]);

  async function handleDelete(emp: Employee) {
    if (!confirm(`Delete employee "${emp.name}"? This cannot be undone.`)) return;
    try {
      await hrApi.deleteEmployee(emp.id);
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || "Failed to delete employee.");
    }
  }

  const columns: ColumnDef<Employee>[] = [
    {
      header: "ID",
      cell: (emp) => (
        <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
          {emp.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      header: "Name",
      cell: (emp) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-semibold text-ink">{emp.name}</span>
        </div>
      ),
    },
    {
      header: "Department",
      cell: (emp) => (
        <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
          {emp.department}
        </span>
      ),
    },
    {
      header: "Designation",
      className: "text-muted text-sm",
      cell: (emp) => emp.designation || "—",
    },
    {
      header: "Reports To",
      className: "text-muted text-sm",
      cell: (emp) => {
        const manager = employees.find((e) => e.id === emp.reportsToId);
        return manager?.name ?? "—";
      },
    },
    {
      header: "Status",
      cell: (emp) => (
        <Badge tone={statusToTone(emp.status)}>{emp.status}</Badge>
      ),
    },
    {
      header: "Actions",
      cell: (emp) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingEmployee(emp);
              setFormOpen(true);
            }}
            aria-label={`Edit ${emp.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 border border-violet-200 text-brand-purple hover:bg-violet-100 transition-all"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(emp)}
            aria-label={`Delete ${emp.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const potentialManagers = employees;
  const visibleEmployees = employees.filter((e) => e.id !== "EMP-100");
  const activeCount = visibleEmployees.filter((e) => e.status === "Active").length;
  const inactiveCount = visibleEmployees.filter((e) => e.status !== "Active").length;

  async function handleCreate(newEmployee: NewEmployeeInput) {
    setLoading(true);
    try {
      const parts = newEmployee.name.trim().split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      await hrApi.createEmployee({
        firstName,
        lastName,
        email: newEmployee.email,
        phone: newEmployee.phone,
        dateOfBirth: newEmployee.dateOfBirth || "1990-01-01",
        hireDate: newEmployee.startDate || new Date().toISOString().split("T")[0],
        employmentType: newEmployee.contractType.toLowerCase().replace("-", "_"),
        departmentId: newEmployee.department,
        managerId: newEmployee.reportsToId || null,
      });
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || "Failed to save employee.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, newEmployee: NewEmployeeInput) {
    setLoading(true);
    try {
      const parts = newEmployee.name.trim().split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";

      await hrApi.updateEmployee(id, {
        firstName,
        lastName,
        email: newEmployee.email,
        phone: newEmployee.phone,
        dateOfBirth: newEmployee.dateOfBirth,
        hireDate: newEmployee.startDate,
        employmentType: newEmployee.contractType.toLowerCase().replace("-", "_"),
        departmentId: newEmployee.department,
        managerId: newEmployee.reportsToId || null,
      });
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingEmployee(null);
  }

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(108,71,255,0.3)]">
              <Users size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink font-display">Employees</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Personal info, contracts, department &amp; reporting hierarchy
          </p>
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => {
            setEditingEmployee(null);
            setFormOpen(true);
          }}
        >
          New Employee
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Employees" value={visibleEmployees.length} icon={<Users size={18} />} gradient="from-violet-500 to-purple-600" delay="0.05s" />
        <StatCard label="Active" value={activeCount} icon={<UserCheck size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Inactive" value={inactiveCount} icon={<UserMinus size={18} />} gradient="from-rose-400 to-pink-500" delay="0.15s" />
        <StatCard label="Departments" value={new Set(visibleEmployees.map((e) => e.department)).size} icon={<TrendingUp size={18} />} gradient="from-cyan-400 to-blue-500" delay="0.20s" />
      </div>

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
          <DataTable data={visibleEmployees} columns={columns} keyExtractor={(emp) => emp.id} emptyMessage="No employees yet. Add the first one to get started." />
        ) : (
          <Card>
            <OrgChart employees={employees} />
          </Card>
        )}
      </div>

      <EmployeeForm
        open={formOpen}
        onClose={closeForm}
        managers={potentialManagers}
        departments={departments}
        editEmployee={editingEmployee}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        loading={loading}
      />
    </div>
  );
}
