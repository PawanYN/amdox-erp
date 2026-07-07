"use client";

import { useEffect, useState } from "react";
import { Plus, Users, UserCheck, UserMinus, Building2, Pencil, Trash2 } from "lucide-react";
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

type DepartmentOption = { id: string; name: string };

type RawEmployee = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  department?: { id?: string; name?: string };
  departmentId?: string;
  designation?: string;
  contractType?: string;
  hireDate?: string;
  managerId?: string | null;
  status?: string;
  dateOfBirth?: string;
};

function mapEmployee(emp: RawEmployee): Employee {
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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEmployees = async () => {
    if (!token) return;
    try {
      setEmployees((await hrApi.getEmployees()).map(mapEmployee));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    if (!token) return;
    try {
      setDepartments(await hrApi.getDepartments());
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete employee.");
    }
  }

  const visibleEmployees = employees.filter((e) => e.id !== "EMP-100");
  const activeCount = visibleEmployees.filter((e) => e.status === "Active").length;
  const inactiveCount = visibleEmployees.filter((e) => e.status !== "Active").length;
  const deptCount = new Set(visibleEmployees.map((e) => e.department)).size;

  const columns: ColumnDef<Employee>[] = [
    {
      header: "Employee",
      cell: (emp) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {emp.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate">{emp.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{emp.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Department",
      cell: (emp) => (
        <span className="text-[12px] font-medium text-slate-600 bg-slate-100 rounded px-2 py-0.5">
          {emp.department}
        </span>
      ),
    },
    {
      header: "Designation",
      cell: (emp) => <span className="text-[13px] text-slate-500">{emp.designation || "—"}</span>,
    },
    {
      header: "Reports To",
      cell: (emp) => {
        const mgr = employees.find((e) => e.id === emp.reportsToId);
        return <span className="text-[13px] text-slate-500">{mgr?.name ?? "—"}</span>;
      },
    },
    {
      header: "Status",
      cell: (emp) => <Badge tone={statusToTone(emp.status)}>{emp.status}</Badge>,
    },
    {
      header: "",
      cell: (emp) => (
        <div className="flex gap-1.5 justify-end">
          <button
            onClick={() => {
              setEditingEmployee(emp);
              setFormOpen(true);
            }}
            className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDelete(emp)}
            className="h-7 w-7 flex items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  async function handleCreate(data: NewEmployeeInput) {
    setLoading(true);
    try {
      const parts = data.name.trim().split(" ");
      await hrApi.createEmployee({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth || "1990-01-01",
        hireDate: data.startDate || new Date().toISOString().split("T")[0],
        employmentType: data.contractType.toLowerCase().replace("-", "_"),
        departmentId: data.department,
        managerId: data.reportsToId || null,
      });
      await fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id: string, data: NewEmployeeInput) {
    setLoading(true);
    try {
      const parts = data.name.trim().split(" ");
      await hrApi.updateEmployee(id, {
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        hireDate: data.startDate,
        employmentType: data.contractType.toLowerCase().replace("-", "_"),
        departmentId: data.department,
        managerId: data.reportsToId || null,
      });
      await fetchEmployees();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users size={18} className="text-slate-500" />
            Employees
          </h1>
          <p className="page-subtitle mt-1">
            Personal info, contracts, departments and reporting hierarchy
          </p>
        </div>
        <Button
          icon={<Plus size={14} />}
          onClick={() => {
            setEditingEmployee(null);
            setFormOpen(true);
          }}
        >
          New Employee
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={visibleEmployees.length}
          icon={<Users size={16} />}
          gradient="from-blue-500 to-blue-600"
          delay="0s"
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={<UserCheck size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          icon={<UserMinus size={16} />}
          gradient="from-slate-400 to-slate-500"
          delay="0.1s"
        />
        <StatCard
          label="Departments"
          value={deptCount}
          icon={<Building2 size={16} />}
          gradient="from-violet-500 to-violet-600"
          delay="0.15s"
        />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(["list", "org-chart"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-all duration-150 ${
              view === v
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {v === "list" ? "List View" : "Org Chart"}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === "list" ? (
        <DataTable
          data={visibleEmployees}
          columns={columns}
          keyExtractor={(emp) => emp.id}
          emptyMessage="No employees yet. Add the first one to get started."
        />
      ) : (
        <Card>
          <OrgChart employees={employees} />
        </Card>
      )}

      <EmployeeForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEmployee(null);
        }}
        managers={employees}
        departments={departments}
        editEmployee={editingEmployee}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        loading={loading}
      />
    </div>
  );
}
