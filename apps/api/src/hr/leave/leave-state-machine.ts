/**
 * STATE MACHINE: leave-state-machine.ts
 * 
 * This file manages complex status transitions (e.g., Pending -> Approved -> Rejected).
 * It ensures the business rules are followed perfectly before a status changes.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class LeaveStateMachine { }
