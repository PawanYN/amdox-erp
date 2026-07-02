"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  AlertTriangle,
  Link2,
  X,
  Loader2,
} from "lucide-react";
import { hrApi } from "@/lib/api/hr-api";
import { pmApi } from "@/lib/api/pm-api";
import { useKeycloak } from "@/components/KeycloakProvider";

/* ──────────────────────────────────────────────
   Project Creation + Resource Allocation
   Built strictly from doc's PM flow spec:

   Step 1 — Create Project
     fields: scope, budget, timeline
     emits: project.scoped { Project.id, budget }

   Step 2 — Tasks/Milestones (WBS + DAG)
     fields: task list with dependencies
     validates: DAG (no circular dependencies)
     emits: tasks.defined { Task[] }

   Step 3 — Resource Allocation
     listens: project.resource_needed (from HR)
     assigns: Employee.id ↔ Task.id
     shows: utilisation heatmap (overload warning)
     emits: resources.assigned { Employee.id ↔ Task.id }
   ────────────────────────────────────────────── */

const STEPS = ["Create Project", "Tasks & Milestones (WBS)", "Resource Allocation"];

type EmployeeOption = {
  id: string;
  name: string;
  role: string;
  currentLoad: number;
};

type TaskDraft = {
  id: string;
  name: string;
  dependsOn: string | null;
  milestoneId: string | null;
};

type MilestoneDraft = {
  id: string;
  name: string;
  dueDate: string;
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-[#D8D5CC] rounded-md bg-white text-[#14171F] placeholder:text-[#B0AC9F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]";

function Field({ label, required, children, hint }: any) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[#14171F]">
        {label}{required && <span className="text-[#B4533B]"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-[#8A8678]">{hint}</p>}
    </label>
  );
}

function EventBadge({ name, payload }: any) {
  return (
    <div className="rounded-md border border-dashed border-[#D8D5CC] bg-[#FAFAF9] px-3 py-2 text-[11px]">
      <span className="text-[#8A8678]">emits event → </span>
      <span className="font-mono text-[#1E3A5F]">{name}</span>
      <span className="text-[#8A8678]"> {"{"} {payload} {"}"}</span>
    </div>
  );
}

/* ── Step 1: Create Project ── */
function StepCreate({ data, setData }: any) {
  return (
    <div className="space-y-5">
      <Field label="Project name" required>
        <input className={inputClass} placeholder="e.g. Warehouse Expansion — Pune" value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })} />
      </Field>
      <Field label="Scope" required hint="What this project covers — used to set boundaries with PM coordination">
        <textarea className={inputClass} rows={3} placeholder="Describe the scope of work..."
          value={data.scope} onChange={(e) => setData({ ...data, scope: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Budget" required hint="Planned spend — Finance compares actuals against this">
          <input type="number" className={inputClass} placeholder="480000" value={data.budget}
            onChange={(e) => setData({ ...data, budget: e.target.value })} />
        </Field>
        <Field label="Currency">
          <select className={inputClass} value={data.currency} onChange={(e) => setData({ ...data, currency: e.target.value })}>
            <option>USD</option><option>INR</option><option>EUR</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" required>
          <input type="date" className={inputClass} value={data.startDate}
            onChange={(e) => setData({ ...data, startDate: e.target.value })} />
        </Field>
        <Field label="Target end date" required>
          <input type="date" className={inputClass} value={data.endDate}
            onChange={(e) => setData({ ...data, endDate: e.target.value })} />
        </Field>
      </div>
      <EventBadge name="project.scoped" payload="Project.id, budget" />
    </div>
  );
}

/* ── Step 2: Milestones + Tasks (WBS + DAG) ── */
function StepTasks({
  tasks,
  setTasks,
  milestones,
  setMilestones,
  projectEndDate,
}: {
  tasks: TaskDraft[];
  setTasks: (t: TaskDraft[]) => void;
  milestones: MilestoneDraft[];
  setMilestones: (m: MilestoneDraft[]) => void;
  projectEndDate: string;
}) {
  const [newMilestone, setNewMilestone] = useState({ name: "", dueDate: projectEndDate || "" });
  const [newTask, setNewTask] = useState({ name: "", dependsOn: "", milestoneId: "" });

  const addMilestone = () => {
    if (!newMilestone.name || !newMilestone.dueDate) return;
    setMilestones([
      ...milestones,
      {
        id: `M-${milestones.length + 1}`,
        name: newMilestone.name,
        dueDate: newMilestone.dueDate,
      },
    ]);
    setNewMilestone({ name: "", dueDate: projectEndDate || "" });
  };

  const addTask = () => {
    if (!newTask.name) return;
    setTasks([
      ...tasks,
      {
        id: `T-${tasks.length + 1}`,
        name: newTask.name,
        dependsOn: newTask.dependsOn || null,
        milestoneId: newTask.milestoneId || null,
      },
    ]);
    setNewTask({ name: "", dependsOn: "", milestoneId: "" });
  };

  const hasCycle = (taskList: TaskDraft[]) =>
    taskList.some((t) => t.dependsOn === t.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[13px] font-medium text-[#14171F] mb-2">Milestones</p>
        <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] p-3 text-[11px] text-[#8A8678] mb-2">
          Key delivery checkpoints with due dates. Overdue milestones trigger alerts.
        </div>
        <div className="space-y-2 mb-3">
          {milestones.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 border border-[#E4E2DC] rounded-md px-3 py-2 bg-white">
              <span className="text-[11px] font-mono text-[#8A8678] w-12">{m.id}</span>
              <span className="flex-1 text-[13px] text-[#14171F]">{m.name}</span>
              <span className="text-[11px] text-[#8A8678]">{m.dueDate}</span>
              <button
                onClick={() => setMilestones(milestones.filter((_, idx) => idx !== i))}
                className="text-[#B0AC9F] hover:text-[#B4533B]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputClass}
            placeholder="Milestone name, e.g. Phase 1 complete"
            value={newMilestone.name}
            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
          />
          <input
            type="date"
            className={inputClass + " max-w-[160px]"}
            value={newMilestone.dueDate}
            onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
          />
          <button
            onClick={addMilestone}
            className="px-3 py-2 text-[13px] font-medium rounded-md bg-[#2F6B4F] text-white whitespace-nowrap"
          >
            + Add milestone
          </button>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-[#14171F] mb-2">Tasks (WBS)</p>
        <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] p-3 text-[11px] text-[#8A8678] mb-2">
          Tasks can link to a milestone and depend on prior tasks — validated as a DAG on save.
        </div>
        <div className="space-y-2">
          {tasks.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 border border-[#E4E2DC] rounded-md px-3 py-2">
              <span className="text-[11px] font-mono text-[#8A8678] w-12">{t.id}</span>
              <span className="flex-1 text-[13px] text-[#14171F]">{t.name}</span>
              {t.milestoneId && (
                <span className="text-[11px] text-[#2F6B4F] bg-[#2F6B4F]/10 px-2 py-0.5 rounded-full">
                  → {t.milestoneId}
                </span>
              )}
              {t.dependsOn && (
                <span className="flex items-center gap-1 text-[11px] text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full">
                  <Link2 size={10} /> after {t.dependsOn}
                </span>
              )}
              <button
                onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}
                className="text-[#B0AC9F] hover:text-[#B4533B]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-[12px] text-[#8A8678] italic py-3 text-center">
              No tasks yet — add work items below (milestones optional).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <input
            className={inputClass + " min-w-[140px] flex-1"}
            placeholder="Task name, e.g. Foundation work"
            value={newTask.name}
            onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
          />
          <select
            className={inputClass + " max-w-[140px]"}
            value={newTask.milestoneId}
            onChange={(e) => setNewTask({ ...newTask, milestoneId: e.target.value })}
          >
            <option value="">No milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}: {m.name}
              </option>
            ))}
          </select>
          <select
            className={inputClass + " max-w-[140px]"}
            value={newTask.dependsOn}
            onChange={(e) => setNewTask({ ...newTask, dependsOn: e.target.value })}
          >
            <option value="">No dependency</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                after {t.id}
              </option>
            ))}
          </select>
          <button
            onClick={addTask}
            className="px-3 py-2 text-[13px] font-medium rounded-md bg-[#1E3A5F] text-white whitespace-nowrap"
          >
            + Add task
          </button>
        </div>

        {hasCycle(tasks) && (
          <div className="flex items-center gap-2 text-[12px] text-[#B4533B] bg-[#B4533B]/10 rounded-md px-3 py-2 mt-2">
            <AlertTriangle size={14} /> Circular dependency detected — a task cannot depend on itself.
          </div>
        )}
      </div>

      <EventBadge name="tasks.defined" payload="Task[] (DAG) + Milestones" />
    </div>
  );
}

/* ── Step 3: Resource Allocation ── */
function StepResources({
  tasks,
  assignments,
  setAssignments,
  employees,
  employeesLoading,
  employeesError,
}: {
  tasks: TaskDraft[];
  assignments: Record<string, string>;
  setAssignments: (a: Record<string, string>) => void;
  employees: EmployeeOption[];
  employeesLoading: boolean;
  employeesError: string | null;
}) {
  const assign = (taskId: string, empId: string) => {
    setAssignments({ ...assignments, [taskId]: empId });
  };

  const loadFor = (empId: string) => {
    const base = employees.find((e) => e.id === empId)?.currentLoad || 0;
    const extra = Object.values(assignments).filter((v) => v === empId).length * 15;
    return base + extra;
  };

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[#8A8678]">
        <Loader2 size={16} className="animate-spin" /> Loading employees from database…
      </div>
    );
  }

  if (employeesError) {
    return (
      <div className="rounded-md border border-[#B4533B]/30 bg-[#B4533B]/10 px-4 py-3 text-[13px] text-[#B4533B]">
        {employeesError}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] px-4 py-6 text-center text-[13px] text-[#8A8678]">
        No employees found in your tenant. Add employees under HR → Employees first, then return here to assign them to tasks.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] p-3 text-[11px] text-[#8A8678]">
        Listens for <span className="font-mono text-[#1E3A5F]">project.resource_needed</span> from HR.
        Assigning here maps <span className="font-mono text-[#1E3A5F]">Employee.id ↔ Task.id</span> — PM never writes to HR's Employee table directly.
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-[12px] text-[#8A8678] italic py-3 text-center">Define tasks in the previous step first.</p>
        )}
        {tasks.map((t: any) => (
          <div key={t.id} className="flex items-center gap-3 border border-[#E4E2DC] rounded-md px-3 py-2">
            <span className="flex-1 text-[13px] text-[#14171F]">{t.name}</span>
            <select
              className={inputClass + " max-w-[220px]"}
              value={assignments[t.id] || ""}
              onChange={(e) => assign(t.id, e.target.value)}
            >
              <option value="">Assign employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} — {e.role}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[13px] font-medium text-[#14171F] mb-2 flex items-center gap-1.5">
          <Users size={14} /> Utilisation after this assignment
        </p>
        <div className="space-y-1.5">
          {employees.map((e) => {
            const load = loadFor(e.id);
            const overloaded = load >= 100;
            return (
              <div key={e.id} className="flex items-center gap-3">
                <span className="w-32 text-[12px] text-[#4A4740] truncate">{e.name}</span>
                <div className="flex-1 h-2 bg-[#F0EEE7] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${overloaded ? "bg-[#B4533B]" : "bg-[#1E3A5F]"}`}
                    style={{ width: `${Math.min(100, load)}%` }}
                  />
                </div>
                <span className={`text-[11px] font-mono w-12 text-right ${overloaded ? "text-[#B4533B] font-medium" : "text-[#8A8678]"}`}>
                  {load}%
                </span>
                {overloaded && <AlertTriangle size={13} className="text-[#B4533B]" />}
              </div>
            );
          })}
        </div>
      </div>

      <EventBadge name="resources.assigned" payload="Employee.id ↔ Task.id" />
    </div>
  );
}

export default function ProjectCreationFlow() {
  const { initialized, token } = useKeycloak();
  const [step, setStep] = useState(0);
  const [project, setProject] = useState({ name: "", scope: "", budget: "", currency: "USD", startDate: "", endDate: "" });
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!initialized || !token) return;

    setEmployeesLoading(true);
    setEmployeesError(null);

    Promise.all([hrApi.getEmployees(), pmApi.getResourceHeatmap()])
      .then(([employeeRows, heatmap]) => {
        const loadByEmployee = new Map(
          heatmap.map((h: { employeeId: string; utilisationPct: number }) => [
            h.employeeId,
            h.utilisationPct,
          ]),
        );

        const options: EmployeeOption[] = employeeRows
          .filter((emp: { status?: string }) => emp.status !== "TERMINATED")
          .map((emp: {
            id: string;
            fullName: string;
            department?: { name: string } | null;
          }) => ({
            id: emp.id,
            name: emp.fullName,
            role: emp.department?.name || "Employee",
            currentLoad: loadByEmployee.get(emp.id) ?? 0,
          }))
          .sort((a: EmployeeOption, b: EmployeeOption) => a.name.localeCompare(b.name));

        setEmployees(options);
      })
      .catch((err) => {
        setEmployeesError(err.message || "Failed to load employees.");
      })
      .finally(() => setEmployeesLoading(false));
  }, [initialized, token]);

  const handleLaunch = async () => {
    if (!project.name.trim()) {
      setSubmitError("Project name is required.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const createdProject = await pmApi.createProject({
        name: project.name.trim(),
        description: project.scope.trim() || undefined,
        startDate: project.startDate || undefined,
        endDate: project.endDate || undefined,
      });

      if (project.budget) {
        await pmApi.setBudget({
          projectId: createdProject.id,
          plannedAmount: Number(project.budget),
        });
      }

      const milestoneIdMap: Record<string, string> = {};
      for (const m of milestones) {
        const created = await pmApi.createMilestone(createdProject.id, {
          name: m.name,
          dueDate: m.dueDate,
        });
        milestoneIdMap[m.id] = created.id;
      }

      const taskIdMap: Record<string, string> = {};
      for (const t of tasks) {
        const dependsOn =
          t.dependsOn && taskIdMap[t.dependsOn]
            ? [taskIdMap[t.dependsOn]]
            : undefined;
        const milestoneId =
          t.milestoneId && milestoneIdMap[t.milestoneId]
            ? milestoneIdMap[t.milestoneId]
            : undefined;

        const created = await pmApi.createTask({
          projectId: createdProject.id,
          title: t.name,
          startDate: project.startDate || undefined,
          dueDate: project.endDate || undefined,
          dependsOn,
          milestoneId,
        });
        taskIdMap[t.id] = created.id;
      }

      const allocationStart =
        project.startDate || new Date().toISOString().split("T")[0];

      for (const [clientTaskId, employeeId] of Object.entries(assignments)) {
        if (!employeeId) continue;
        const taskId = taskIdMap[clientTaskId];
        if (!taskId) continue;

        await pmApi.allocateResource({
          projectId: createdProject.id,
          taskId,
          employeeId,
          allocatedHours: 8,
          startDate: allocationStart,
          endDate: project.endDate || undefined,
        });
      }

      router.push("/projects/overview");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F2EC] flex items-start justify-center py-10 px-4"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div className="w-full max-w-2xl bg-white rounded-xl border border-[#E4E2DC] shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E2DC]">
          <div>
            <h1 className="text-base font-semibold text-[#14171F] flex items-center gap-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <FolderKanban size={17} className="text-[#1E3A5F]" /> New Project
            </h1>
            <p className="text-[12px] text-[#8A8678]">PM › Projects › New</p>
          </div>
          <span className="text-[10px] font-mono text-white bg-[#8A8678] px-1.5 py-0.5 rounded">V2</span>
        </div>

        {/* step indicator */}
        <div className="flex items-center px-6 pt-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 text-[12px] font-medium ${
                  i < step ? "bg-[#1E3A5F] border-[#1E3A5F] text-white"
                  : i === step ? "border-[#1E3A5F] text-[#1E3A5F] bg-white"
                  : "border-[#D8D5CC] text-[#B0AC9F] bg-white"
                }`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`mt-1 text-[10px] font-medium text-center w-20 ${i === step ? "text-[#1E3A5F]" : "text-[#8A8678]"}`}>
                  {s}
                </span>
              </div>
              {i !== STEPS.length - 1 && (
                <div className={`flex-1 h-[2px] mx-2 mb-4 ${i < step ? "bg-[#1E3A5F]" : "bg-[#E4E2DC]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-6 min-h-[320px]">
          {step === 0 && <StepCreate data={project} setData={setProject} />}
          {step === 1 && (
            <StepTasks
              tasks={tasks}
              setTasks={setTasks}
              milestones={milestones}
              setMilestones={setMilestones}
              projectEndDate={project.endDate}
            />
          )}
          {step === 2 && (
            <StepResources
              tasks={tasks}
              assignments={assignments}
              setAssignments={setAssignments}
              employees={employees}
              employeesLoading={employeesLoading}
              employeesError={employeesError}
            />
          )}
        </div>

        {submitError && (
          <div className="mx-6 mb-2 rounded-md border border-[#B4533B]/30 bg-[#B4533B]/10 px-3 py-2 text-[12px] text-[#B4533B]">
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E4E2DC]">
          <button onClick={() => {
            if (step === 0) {
              router.push("/projects/overview");
            } else {
              setStep((s) => Math.max(0, s - 1));
            }
          }}
            className={`inline-flex items-center gap-1 text-[13px] font-medium px-3 py-2 rounded-md ${
              false ? "text-[#D8D5CC] cursor-not-allowed" : "text-[#4A4740] hover:bg-[#F4F2EC]"
            }`}>
            <ChevronLeft size={15} /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1 text-[13px] font-medium px-4 py-2 rounded-md bg-[#1E3A5F] text-white hover:bg-[#16304d]">
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleLaunch}
              disabled={submitting || employeesLoading}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-md bg-[#2F6B4F] text-white hover:bg-[#255a41] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Check size={15} /> Launch project
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
