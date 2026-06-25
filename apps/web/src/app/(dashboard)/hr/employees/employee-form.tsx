"use client";

import { FormEvent, useState } from "react";
import { Modal, FormField, inputClasses } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Employee } from "@/lib/types";

const DEPARTMENTS = [
  "Finance",
  "Engineering",
  "Supply Chain",
  "HR",
  "Leadership",
];

const CONTRACT_TYPES: Employee["contractType"][] = [
  "Full-time",
  "Part-time",
  "Contract",
  "Intern",
];

export function EmployeeForm({
  open,
  onClose,
  managers,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  managers: Employee[];
  onCreate: (employee: Omit<Employee, "id" | "status">) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [contractType, setContractType] =
    useState<Employee["contractType"]>("Full-time");
  const [startDate, setStartDate] = useState("");
  const [reportsToId, setReportsToId] = useState<string>("");

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setDepartment(DEPARTMENTS[0]);
    setContractType("Full-time");
    setStartDate("");
    setReportsToId("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO(Task 5 — backend): POST /api/hr/employees with this payload
    // instead of calling onCreate directly. See lib/api/contracts.ts
    // for CreateEmployeeRequest.
    onCreate({
      name,
      email,
      phone,
      department,
      designation: "", // designation isn't in the spec'd form fields —
      // left blank here; add a field above if the backend requires it
      // on create rather than as a follow-up edit.
      contractType,
      startDate,
      reportsToId: reportsToId || null,
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
      title="New Employee"
      description="Personal info, employment contract, and reporting line."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <fieldset className="space-y-4">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Personal Info
          </legend>
          <FormField label="Full name">
            <input
              required
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input
                required
                type="email"
                className={inputClasses}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@amdox.com"
              />
            </FormField>
            <FormField label="Phone">
              <input
                required
                className={inputClasses}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98100 00000"
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Employment Contract
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contract type">
              <select
                className={inputClasses}
                value={contractType}
                onChange={(e) =>
                  setContractType(e.target.value as Employee["contractType"])
                }
              >
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Start date">
              <input
                required
                type="date"
                className={inputClasses}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Department &amp; Reporting
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department">
              <select
                className={inputClasses}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Reporting manager">
              <select
                className={inputClasses}
                value={reportsToId}
                onChange={(e) => setReportsToId(e.target.value)}
              >
                <option value="">No manager (top of hierarchy)</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.designation}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save employee
          </Button>
        </div>
      </form>
    </Modal>
  );
}
