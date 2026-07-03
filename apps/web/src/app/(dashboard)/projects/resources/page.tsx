"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Users, BarChart2 } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { hrApi } from "@/lib/api/hr-api";

type Employee = { id: string; fullName: string; department?: { name: string } };
type Project = { id: string; name: string; status: string };
type Allocation = {
  id: string;
  employeeId: string;
  employeeName: string;
  project: { id: string; name: string };
  task?: { id: string; title: string } | null;
  allocatedHours: number;
  startDate: string;
  endDate?: string | null;
};
type HeatmapRow = {
  employeeId: string;
  name: string;
  totalAllocatedHours: number;
  projectCount: number;
  isOverAllocated: boolean;
  utilisationPct: number;
};

function AllocateModal({
  employees,
  projects,
  onClose,
  onSuccess,
}: {
  employees: Employee[];
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [allocatedHours, setAllocatedHours] = useState("40");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!employeeId || !projectId || !allocatedHours || !startDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await pmApi.allocateResource({
        employeeId,
        projectId,
        allocatedHours: Number(allocatedHours),
        startDate,
        endDate: endDate || undefined,
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to allocate resource");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses =
    "w-full text-sm border border-[#D8D5CC] rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-[#E4E2DC] shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E2DC]">
          <h2 className="text-sm font-semibold text-[#14171F]">Allocate resource to project</h2>
          <button onClick={onClose} className="text-[#8A8678] hover:text-[#14171F]">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[12px] text-[#8A8678]">
            Allocation triggers{" "}
            <span className="font-mono text-[#1E3A5F]">resources.assigned</span>{" "}
            event. Payroll will then distribute labor cost to this project automatically.
          </p>

          <label className="block text-[12px] font-medium text-[#14171F]">
            Employee
            <select
              className={`mt-1 ${inputClasses}`}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[#14171F]">
            Project
            <select
              className={`mt-1 ${inputClasses}`}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[12px] font-medium text-[#14171F]">
            Allocated hours
            <input
              type="number"
              min={1}
              className={`mt-1 ${inputClasses}`}
              value={allocatedHours}
              onChange={(e) => setAllocatedHours(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-[#14171F]">
              Start date
              <input
                type="date"
                className={`mt-1 ${inputClasses}`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#14171F]">
              End date (optional)
              <input
                type="date"
                className={`mt-1 ${inputClasses}`}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-[12px] text-[#B4533B]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#E4E2DC]">
          <button
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[#D8D5CC] text-[#4A4740]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !employeeId || !projectId}
            className="text-[12px] px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
          >
            {submitting ? "Allocating…" : "Allocate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsResourcesPage() {
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<"allocations" | "heatmap">("allocations");

  const load = useCallback(() => {
    return Promise.all([
      pmApi.getResourceHeatmap().then(setHeatmap),
      pmApi.getAllocations().then(setAllocations),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    // Load employees + projects for the modal (non-blocking)
    hrApi.getEmployees().then(setEmployees);
    pmApi
      .getProjects()
      .then((ps: Project[]) =>
        setProjects(ps.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED"))
      );
  }, [load]);

  if (loading) return <p className="text-sm text-muted">Loading resources…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("allocations")}
            className={`text-[12px] px-3 py-1.5 rounded-md font-medium ${
              tab === "allocations"
                ? "bg-[#1E3A5F] text-white"
                : "border border-[#D8D5CC] text-[#4A4740]"
            }`}
          >
            <Users size={12} className="inline mr-1" />
            Allocations
          </button>
          <button
            onClick={() => setTab("heatmap")}
            className={`text-[12px] px-3 py-1.5 rounded-md font-medium ${
              tab === "heatmap"
                ? "bg-[#1E3A5F] text-white"
                : "border border-[#D8D5CC] text-[#4A4740]"
            }`}
          >
            <BarChart2 size={12} className="inline mr-1" />
            Utilisation heatmap
          </button>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={employees.length === 0 || projects.length === 0}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
        >
          <Plus size={13} /> Allocate resource
        </button>
      </div>

      {tab === "allocations" && (
        <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
              <tr>
                <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Person</th>
                <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Project</th>
                <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Task</th>
                <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Hours</th>
                <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Period</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-muted text-center text-sm">
                    No allocations yet. Click "Allocate resource" to assign an employee to a project.
                  </td>
                </tr>
              ) : (
                allocations.map((a) => (
                  <tr key={a.id} className="border-b border-[#F0EEE7]">
                    <td className="px-4 py-2 font-medium text-[#14171F]">{a.employeeName}</td>
                    <td className="px-4 py-2 text-[#4A4740]">{a.project.name}</td>
                    <td className="px-4 py-2 text-[#8A8678]">{a.task?.title ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{a.allocatedHours}h</td>
                    <td className="px-4 py-2 text-[12px] text-[#8A8678]">
                      {new Date(a.startDate).toLocaleDateString()}
                      {a.endDate ? ` → ${new Date(a.endDate).toLocaleDateString()}` : " →"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "heatmap" && (
        <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
              <tr>
                <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Person</th>
                <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Hours</th>
                <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Utilisation</th>
                <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Projects</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-muted text-center">
                    No resource allocations yet.
                  </td>
                </tr>
              ) : (
                heatmap.map((p) => (
                  <tr key={p.employeeId} className="border-b border-[#F0EEE7]">
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{p.totalAllocatedHours}h</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.isOverAllocated ? "bg-[#B4533B]" : "bg-[#2F6B4F]"}`}
                            style={{ width: `${p.utilisationPct}%` }}
                          />
                        </div>
                        <span className={p.isOverAllocated ? "text-[#B4533B]" : "text-[#2F6B4F]"}>
                          {p.utilisationPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">{p.projectCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && employees.length > 0 && projects.length > 0 && (
        <AllocateModal
          employees={employees}
          projects={projects}
          onClose={() => setModalOpen(false)}
          onSuccess={() => load()}
        />
      )}
    </div>
  );
}
