"use client";
import { toast } from "@/components/ui/toast";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Employee, NewEmployeeInput } from "@/lib/types/hr";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import { hrApi } from "@/lib/api/hr-api";
import { EmployeeForm } from "../employee-form";

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
  };
}

export default function NewEmployeePage() {
  const router = useRouter();
  const { token, initialized } = useKeycloak();
  const [managers, setManagers] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialized || !token) return;
    (async () => {
      try {
        const [emps, depts] = await Promise.all([
          hrApi.getEmployees("active"),
          hrApi.getDepartments(),
        ]);
        setManagers((emps as RawEmployee[]).map(mapEmployee));
        setDepartments(depts);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [initialized, token]);

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
        designation: data.designation || undefined,
        salary: data.salary,
        currencyCode: data.currencyCode,
        provideErpAccess: data.provideErpAccess ?? true,
        systemRole: data.systemRole || "Employee",
        allowedModules: data.allowedModules ?? [],
      });
      router.push("/hr/employees");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save.", "error");
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

      <EmployeeForm
        onClose={() => router.push("/hr/employees")}
        managers={managers}
        departments={departments}
        onCreate={handleCreate}
        loading={loading}
      />
    </div>
  );
}
