# HR Core: Attendance & Leave Management Business Rules

This document outlines the executive decisions made regarding the business logic for the Leave Management and Attendance modules where the original specification was undefined.

## 1. Leave Approvals
**Decision:** Leaves can only be approved by the employee's **Direct Manager** (the user whose ID matches the `managerId` on the Employee record) or a **TenantAdmin**.
**Reasoning:** Allowing any random manager to approve leaves could lead to unauthorized approvals across different departments. Enforcing a direct reporting line maintains a strict chain of command and accountability.

## 2. Overtime Threshold
**Decision:** Overtime is calculated for any time worked over **8 hours** in a single day.
**Reasoning:** 8 hours is the global standard for a full-time daily shift. Any duration exceeding 8 hours between `clockIn` and `clockOut` will automatically increment the `overtimeHours` counter.

## 3. Clock-Out Fallback (Forgotten Clock-Outs)
**Decision:** If an employee forgets to clock out, the `clockOut` field will remain **null**. The system will **NOT** automatically close it at midnight.
**Reasoning:** Auto-closing at midnight would inaccurately log hours (potentially paying an employee for 16 hours of work if they left at 5 PM). Leaving it `null` forces a manager to manually intervene and correct the timesheet, ensuring payroll accuracy.
