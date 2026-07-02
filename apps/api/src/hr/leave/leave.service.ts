import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, LeaveStatus } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateLeaveDto } from '../dto/create-leave.dto';
import { ApproveLeaveDto } from '../dto/approve-leave.dto';
import { LeaveStateMachine } from './leave-state-machine';

@Injectable()
export class LeaveService {
  private prisma = new PrismaClient();

  constructor(
    private readonly leaveStateMachine: LeaveStateMachine,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createRequest(tenantId: string, createLeaveDto: CreateLeaveDto) {
    const start = new Date(createLeaveDto.startDate);
    const end = new Date(createLeaveDto.endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date.');
    }

    const typeMapping: Record<string, string> = {
      annual: 'Annual Leave',
      sick: 'Sick Leave',
      maternity: 'Maternity Leave',
      unpaid: 'Unpaid Leave'
    };

    const dbLeaveTypeName = typeMapping[createLeaveDto.leaveType];
    const leaveTypeRecord = await this.prisma.leaveType.findFirst({
      where: { tenantId, name: dbLeaveTypeName }
    });

    if (!leaveTypeRecord) {
      throw new BadRequestException(`Leave type '${dbLeaveTypeName}' not found for this tenant.`);
    }

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: createLeaveDto.employeeId,
        leaveTypeId: leaveTypeRecord.id,
        startDate: start,
        endDate: end,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async getMyRequests(tenantId: string, employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { tenantId, employeeId },
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllRequests(tenantId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { tenantId },
      include: { leaveType: true, employee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyBalances(tenantId: string, employeeId: string) {
    return this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId },
      include: { leaveType: true },
    });
  }

  async approveOrReject(tenantId: string, leaveId: string, approveLeaveDto: ApproveLeaveDto, isTenantAdmin: boolean) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { employee: true },
    });

    if (!leave || leave.tenantId !== tenantId) {
      throw new NotFoundException('Leave request not found.');
    }

    const targetStatus = approveLeaveDto.status.toUpperCase() as LeaveStatus;

    // Delegate business rule enforcement to the State Machine
    this.leaveStateMachine.validateTransition(
      leave, 
      targetStatus, 
      approveLeaveDto.managerEmployeeId, 
      isTenantAdmin
    );

    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: targetStatus,
        approvedAt: new Date(),
      },
    });
    this.eventEmitter.emit('leave.status.changed', {
      tenantId,
      leaveId,
      status: targetStatus,
    });
    return updated;
  }
}

