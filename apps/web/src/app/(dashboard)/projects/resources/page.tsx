"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Users, BarChart2, Loader2, Trash2, Package } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";

type Employee = {
  id: string;
  fullName: string;
  designation?: string | null;
  department?: { name: string } | null;
};
type Task = { id: string; title: string };
type Project = { id: string; name: string; status: string };
type Allocation = {
  id: string;
  employeeId: string;
  employee?: { fullName: string };
  employeeName?: string;
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
type MaterialRequestLine = {
  id: string;
  product: { id: string; sku: string; name: string };
  quantity: number;
  estimatedUnitPrice?: number | null;
};
type MaterialRequest = {
  id: string;
  project: { id: string; name: string } | null;
  reason?: string | null;
  createdAt: string;
  status: string;
  lines: MaterialRequestLine[];
};

const materialStatusStyle: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PARTIALLY_RECEIVED: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const inputClass =
  "w-full text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";

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
  const [taskId, setTaskId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [allocatedHours, setAllocatedHours] = useState("8");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setTaskId("");
      return;
    }

    setTasksLoading(true);
    setError(null);
    Promise.all([pmApi.getTasks(projectId), pmApi.getProject(projectId)])
      .then(([taskRows, project]) => {
        const list: Task[] = (taskRows as { id: string; title: string }[]).map((t) => ({
          id: t.id,
          title: t.title,
        }));
        setTasks(list);
        setTaskId(list[0]?.id ?? "");

        const proj = project as { startDate?: string; endDate?: string };
        if (proj.startDate) {
          setStartDate(new Date(proj.startDate).toISOString().slice(0, 10));
        }
        if (proj.endDate) {
          setEndDate(new Date(proj.endDate).toISOString().slice(0, 10));
        } else {
          setEndDate("");
        }
      })
      .catch((e) => {
        setTasks([]);
        setTaskId("");
        setError(e instanceof Error ? e.message : "Failed to load project tasks.");
      })
      .finally(() => setTasksLoading(false));
  }, [projectId]);

  const submit = async () => {
    if (!employeeId || !projectId || !allocatedHours || !startDate) return;
    if (tasks.length > 0 && !taskId) {
      setError("Select a task for this allocation.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await pmApi.allocateResource({
        employeeId,
        projectId,
        taskId: taskId || undefined,
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

  const employeeLabel = (emp: Employee) =>
    `${emp.fullName} — ${emp.designation || emp.department?.name || "Employee"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] px-4">
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-modal">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-semibold text-slate-900">Allocate resource to task</h2>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-slate-500">
            Maps <span className="font-mono text-blue-700">Employee.id ↔ Task.id</span> on the
            selected project — same model as the new-project wizard. Triggers{" "}
            <span className="font-mono text-blue-700">resources.assigned</span>.
          </p>

          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Project</label>
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Task</label>
            {tasksLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-slate-500 py-2">
                <Loader2 size={14} className="animate-spin" /> Loading tasks…
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                No tasks on this project yet. Add tasks under Projects → Tasks & Gantt first, or
                save a project-level allocation without a task.
              </p>
            ) : (
              <select
                className={inputClass}
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Employee</label>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {employeeLabel(emp)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Allocated hours
            </label>
            <input
              type="number"
              min={0.5}
              step={0.5}
              className={inputClass}
              value={allocatedHours}
              onChange={(e) => setAllocatedHours(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Default 8h per task — same as new-project wizard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                Start date
              </label>
              <input
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                End date (optional)
              </label>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="text-[13px] font-medium px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={
              submitting ||
              !employeeId ||
              !projectId ||
              tasksLoading ||
              (tasks.length > 0 && !taskId)
            }
            className="text-[13px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<"allocations" | "heatmap" | "items">("allocations");

  const load = useCallback(() => {
    return Promise.all([
      pmApi.getResourceHeatmap().then(setHeatmap),
      pmApi.getAllocations().then((rows) =>
        setAllocations(
          rows.map((a: Allocation) => ({
            ...a,
            employeeName: a.employeeName ?? a.employee?.fullName ?? "—",
          })),
        ),
      ),
      pmApi.getMaterialRequests().then((rows) => setMaterialRequests(rows as MaterialRequest[])),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleDeleteAllocation(id: string, name: string) {
    if (!confirm(`Remove allocation for ${name}?`)) return;
    try {
      await pmApi.deleteAllocation(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove allocation");
    }
  }

  useEffect(() => {
    load();
    pmApi.getAllocatableEmployees().then(setEmployees);
    pmApi
      .getProjects()
      .then((ps: Project[]) =>
        setProjects(ps.filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED")),
      );
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading resources…</p>;

  const thClass =
    "text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
  const tdClass = "px-4 py-2.5 text-sm text-slate-700";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setTab("allocations")}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === "allocations"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Users size={13} /> Allocations
          </button>
          <button
            onClick={() => setTab("heatmap")}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === "heatmap"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <BarChart2 size={13} /> Utilisation heatmap
          </button>
          <button
            onClick={() => setTab("items")}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors ${
              tab === "items"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package size={13} /> Items
          </button>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={employees.length === 0 || projects.length === 0}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Plus size={13} /> Allocate resource
        </button>
      </div>

      {tab === "allocations" && (
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Person</th>
                <th className={thClass}>Project</th>
                <th className={thClass}>Task</th>
                <th className={`${thClass} text-right`}>Hours</th>
                <th className={thClass}>Period</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-slate-500 text-center text-sm">
                    No allocations yet. Click &quot;Allocate resource&quot; to assign an employee to
                    a project task.
                  </td>
                </tr>
              ) : (
                allocations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${tdClass} font-semibold text-slate-900`}>{a.employeeName}</td>
                    <td className={tdClass}>{a.project.name}</td>
                    <td className={`${tdClass} text-slate-500`}>{a.task?.title ?? "—"}</td>
                    <td className={`${tdClass} text-right font-mono`}>{a.allocatedHours}h</td>
                    <td className={`${tdClass} text-[12px] text-slate-500`}>
                      {new Date(a.startDate).toLocaleDateString()}
                      {a.endDate ? ` → ${new Date(a.endDate).toLocaleDateString()}` : " →"}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <button
                        onClick={() => handleDeleteAllocation(a.id, a.employeeName ?? "employee")}
                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 inline-flex"
                        title="Remove allocation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "heatmap" && (
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Person</th>
                <th className={`${thClass} text-right`}>Hours</th>
                <th className={`${thClass} text-right`}>Utilisation</th>
                <th className={`${thClass} text-right`}>Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {heatmap.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-slate-500 text-center">
                    No resource allocations yet.
                  </td>
                </tr>
              ) : (
                heatmap.map((p) => (
                  <tr key={p.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`${tdClass} font-semibold text-slate-900`}>{p.name}</td>
                    <td className={`${tdClass} text-right font-mono`}>{p.totalAllocatedHours}h</td>
                    <td className={tdClass}>
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.isOverAllocated ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(p.utilisationPct, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-[12px] font-mono font-semibold w-10 text-right ${p.isOverAllocated ? "text-red-600" : "text-emerald-700"}`}
                        >
                          {p.utilisationPct}%
                        </span>
                      </div>
                    </td>
                    <td className={`${tdClass} text-right`}>{p.projectCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "items" && (
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className={thClass}>Project</th>
                <th className={thClass}>Item</th>
                <th className={`${thClass} text-right`}>Quantity</th>
                <th className={`${thClass} text-right`}>Est. unit price</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materialRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-slate-500 text-center text-sm">
                    No items requested from Supply Chain Management yet.
                  </td>
                </tr>
              ) : (
                materialRequests.flatMap((r) =>
                  r.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className={`${tdClass} font-semibold text-slate-900`}>
                        {r.project?.name ?? "—"}
                      </td>
                      <td className={tdClass}>
                        <span className="font-mono text-[12px] text-slate-500 mr-1.5">
                          {line.product.sku}
                        </span>
                        {line.product.name}
                      </td>
                      <td className={`${tdClass} text-right font-mono`}>{Number(line.quantity)}</td>
                      <td className={`${tdClass} text-right font-mono`}>
                        {line.estimatedUnitPrice != null
                          ? Number(line.estimatedUnitPrice).toFixed(2)
                          : "—"}
                      </td>
                      <td className={tdClass}>
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            materialStatusStyle[r.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className={`${tdClass} text-[12px] text-slate-500`}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )),
                )
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
