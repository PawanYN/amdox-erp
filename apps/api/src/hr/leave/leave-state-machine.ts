/**
 * ============================================================================
 * STATE MACHINE: leave-state-machine.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This handles the formal workflow for Leave Requests. It dictates exactly 
 * which status transitions are allowed (e.g. you cannot "Approve" a leave 
 * that is already "Rejected" or "Cancelled").
 * 
 * HOW IT IS IMPLEMENTED:
 * - We enforce the Business Rule: Only the employee's direct manager (or 
 *   a global Tenant Admin) is allowed to approve or reject a leave.
 * - It throws HTTP Exceptions automatically if the transition is illegal.
 * ============================================================================
 */
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveStatus } from '@amdox/db';

export interface LeaveEntity {
  id: string;
  tenantId: string;
  status: LeaveStatus;
  employee: {
    managerId: string | null;
  };
}

@Injectable()
export class LeaveStateMachine {
  
  public validateTransition(
    leave: LeaveEntity, 
    newStatus: LeaveStatus, 
    approvingManagerId: string, 
    isTenantAdmin: boolean
  ): void {
    // 1. Validate Current State
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Cannot change status. Leave is already ${leave.status}.`);
    }

    // 2. Validate Allowed Target State
    if (newStatus !== LeaveStatus.APPROVED && newStatus !== LeaveStatus.REJECTED) {
      throw new BadRequestException(`Invalid state transition to ${newStatus}.`);
    }

    // 3. Enforce Business Authorization (Manager or Admin)
    if (!isTenantAdmin && leave.employee.managerId !== approvingManagerId) {
      throw new ForbiddenException('Only the direct manager can approve this leave request.');
    }
  }
}
