"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import { hrApi } from "@/lib/api/hr-api";
import { Employee } from "@/lib/types/hr";
import { OrgChart } from "../employees/org-chart";

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
  };
}

export default function OrgChartPage() {
  const { token } = useKeycloak();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (!token) return;
    hrApi
      .getEmployees()
      .then((rows) => setEmployees(rows.map(mapEmployee)))
      .catch(console.error);
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Network size={18} style={{color: '#6b7280'}} />
          Organization Chart
        </h1>
        <p className="page-subtitle mt-1" style={{color: '#6b7280'}}>Reporting hierarchy across departments</p>
      </div>
      <div style={{background: '#ffffff', border: '1px solid #dfe3e8'}} className="rounded-lg shadow-card">
        <OrgChart employees={employees} />
      </div>
    </div>
  );
}
