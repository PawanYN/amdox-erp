"use client";

import { FormEvent, useState } from "react";
import { Modal, inputClasses } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Employee } from "@/lib/types";

const STEPS = [
  { id: 1, label: "Personal Info" },
  { id: 2, label: "Job Details" },
  { id: 3, label: "System Access" },
];

const ROLES = ["TenantAdmin", "Manager", "Viewer"];

export function EmployeeForm({
  open,
  onClose,
  managers,
  departments,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  managers: Employee[];
  departments: any[];
  onCreate: (employee: Omit<Employee, "id" | "status">) => void;
}) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dob: "",
    code: "",
    hireDate: "",
    departmentId: "",
    managerId: "",
    employmentType: "Full-time" as Employee["contractType"],
    needsAccess: false,
    role: "",
  });

  function reset() {
    setStep(1);
    setData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dob: "",
      code: "",
      hireDate: "",
      departmentId: "",
      managerId: "",
      employmentType: "Full-time",
      needsAccess: false,
      role: "",
    });
  }

  function handleNext() {
    if (step === 1) {
      if (!data.firstName || !data.lastName || !data.email) {
        alert("Please fill in all required fields.");
        return;
      }
    } else if (step === 2) {
      if (!data.hireDate || !data.departmentId) {
        alert("Please fill in all required fields.");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onCreate({
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: data.phone,
      department: data.departmentId, 
      designation: data.role || "", 
      contractType: data.employmentType,
      startDate: data.hireDate,
      reportsToId: data.managerId || null,
    });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add Employee"
      description="HR › Employees › New"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center mb-6">
          {STEPS.map((s, i) => {
            const isDone = s.id < step;
            const isActive = s.id === step;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 text-xs font-semibold transition-colors ${
                    isDone ? "bg-brand-purple border-brand-purple text-white"
                    : isActive ? "border-brand-purple text-brand-purple bg-white"
                    : "border-line text-muted bg-white"
                  }`}>
                    {isDone ? "✓" : s.id}
                  </div>
                  <span className={`mt-1.5 text-[10px] font-semibold tracking-wide uppercase ${isActive ? "text-brand-purple" : "text-muted"}`}>
                    {s.label}
                  </span>
                </div>
                {s.id !== STEPS.length && (
                  <div className={`flex-1 h-[2px] mx-2 mb-4 transition-colors ${isDone ? "bg-brand-purple" : "bg-line"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Contents */}
        <div className="min-h-[280px]">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink">First name <span className="text-rose-500">*</span></label>
                  <input className={`${inputClasses} mt-1`} placeholder="e.g. Ananya" value={data.firstName}
                    onChange={(e) => setData({ ...data, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">Last name <span className="text-rose-500">*</span></label>
                  <input className={`${inputClasses} mt-1`} placeholder="e.g. Rao" value={data.lastName}
                    onChange={(e) => setData({ ...data, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Email <span className="text-rose-500">*</span></label>
                  <input type="email" className={`${inputClasses} mt-1`} placeholder="ananya.rao@acme.com" value={data.email}
                    onChange={(e) => setData({ ...data, email: e.target.value })} />
                  <p className="mt-1 text-[10px] text-muted font-medium">Used for payslips & notifications</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Phone</label>
                  <input className={`${inputClasses} mt-1`} placeholder="+91 98765 43210" value={data.phone}
                    onChange={(e) => setData({ ...data, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink font-medium">Date of birth</label>
                <input type="date" className={`${inputClasses} mt-1 max-w-xs`} value={data.dob}
                  onChange={(e) => setData({ ...data, dob: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Employee code</label>
                  <input className={`${inputClasses} mt-1`} placeholder="AMX-EMP-0142" value={data.code}
                    onChange={(e) => setData({ ...data, code: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Hire date <span className="text-rose-500">*</span></label>
                  <input type="date" className={`${inputClasses} mt-1`} value={data.hireDate}
                    onChange={(e) => setData({ ...data, hireDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Department <span className="text-rose-500">*</span></label>
                  <select className={`${inputClasses} mt-1`} value={data.departmentId}
                    onChange={(e) => setData({ ...data, departmentId: e.target.value })}>
                    <option value="">Select department</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink font-medium">Reports to</label>
                  <select className={`${inputClasses} mt-1`} value={data.managerId}
                    onChange={(e) => setData({ ...data, managerId: e.target.value })}>
                    <option value="">Select manager</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.designation || 'Lead'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink font-medium">Employment type <span className="text-rose-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  {(["Full-time", "Part-time", "Contract", "Intern"] as Employee["contractType"][]).map((type) => (
                    <button key={type} type="button"
                      onClick={() => setData({ ...data, employmentType: type })}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                        data.employmentType === type
                          ? "bg-brand-purple border-brand-purple text-white shadow-sm"
                          : "border-line text-muted hover:bg-canvas"
                      }`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-canvas/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">This employee needs ERP login access</p>
                    <p className="text-xs text-muted mt-1 max-w-md">
                      Leave this off for floor staff or roles that don't need the system —
                      their manager can record attendance and leaves on their behalf instead.
                    </p>
                  </div>
                  <button type="button" role="switch" aria-checked={data.needsAccess}
                    onClick={() => setData({ ...data, needsAccess: !data.needsAccess })}
                    className={`shrink-0 h-6 w-11 rounded-full transition-colors relative ${
                      data.needsAccess ? "bg-brand-purple" : "bg-line"
                    }`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      data.needsAccess ? "translate-x-[22px]" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                {data.needsAccess && (
                  <div className="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-ink font-medium">Assign role <span className="text-rose-500">*</span></label>
                      <select className={`${inputClasses} mt-1`} value={data.role}
                        onChange={(e) => setData({ ...data, role: e.target.value })}>
                        <option value="">Select role</option>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-ink font-medium">Invite</label>
                      <div className="flex items-center h-[38px] text-xs font-semibold text-emerald-600 gap-1.5 mt-1">
                        ✓ Login invitation sent on save
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {!data.needsAccess && (
                <div className="rounded-xl border border-dashed border-line p-4 text-xs text-muted">
                  Attendance source for this employee will default to <span className="font-mono text-ink">manual</span>, recorded by their manager from the Attendance page.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-4 border-t border-line">
          <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1}>
            ← Back
          </Button>
          {step < 3 ? (
            <Button type="button" variant="primary" onClick={handleNext}>
              Continue →
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={handleSubmit}>
              ✓ Save employee
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
