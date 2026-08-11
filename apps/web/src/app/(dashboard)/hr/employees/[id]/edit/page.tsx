"use client";
import { toast } from "@/components/ui/toast";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Employee, NewEmployeeInput } from "@/lib/types/hr";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import { hrApi } from "@/lib/api/hr-api";
import { EmployeeForm } from "../../employee-form";

type DepartmentOption = { id: string; name: string; code?: string; allowedModules?: string[] };

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
  deletedAt?: string | null;
  dateOfBirth?: string;
  contracts?: { salary?: string | number; currencyCode?: string }[];
};

function mapEmployee(emp: RawEmployee): Employee {
  const inactive =
    Boolean(emp.deletedAt) || emp.status === "TERMINATED" || emp.status === "SUSPENDED";
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
    status: inactive ? "Inactive" : "Active",
    dateOfBirth: emp.dateOfBirth
      ? new Date(emp.dateOfBirth).toISOString().split("T")[0]
      : undefined,
    salary: emp.contracts?.[0]?.salary != null ? Number(emp.contracts[0].salary) : undefined,
    currencyCode: emp.contracts?.[0]?.currencyCode,
  };
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const { token, initialized } = useKeycloak();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!initialized || !token) return;
    (async () => {
      try {
        const [emps, depts] = await Promise.all([
          hrApi.getEmployees("all"),
          hrApi.getDepartments(),
        ]);
        setEmployees((emps as RawEmployee[]).map(mapEmployee));
        setDepartments(depts);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    })();
  }, [initialized, token]);

  const editEmployee = employees.find((e) => e.id === employeeId) || null;
  const managers = employees.filter((e) => e.status === "Active" && e.id !== employeeId);

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
        designation: data.designation || undefined,
        salary: data.salary,
        currencyCode: data.currencyCode,
        ...(data.allowedModules ? { allowedModules: data.allowedModules } : {}),
        ...(data.systemRole ? { systemRole: data.systemRole } : {}),
      });
      router.push("/hr/employees");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/hr/employees"
        className="inline-flex items-center gap-1 text-[12px] hover:underline"
        style={{ color: "#6b7280" }}
      >
        <ChevronLeft size={14} /> Back to employees
      </Link>

      {fetching ? (
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Loading employee…
        </p>
      ) : !editEmployee ? (
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Employee not found.
        </p>
      ) : (
        <EmployeeForm
          onClose={() => router.push("/hr/employees")}
          managers={managers}
          departments={departments}
          editEmployee={editEmployee}
          onCreate={() => {}}
          onUpdate={handleUpdate}
          loading={loading}
        />
      )}
    </div>
  );
}
