import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, LeaveStatus } from '@amdox/db';
import { CreateLeaveDto } from '../dto/create-leave.dto';
import { ApproveLeaveDto } from '../dto/approve-leave.dto';
import { LeaveStateMachine } from './leave-state-machine';

@Injectable()
export class LeaveService {
  private prisma = new PrismaClient();

  constructor(private readonly leaveStateMachine: LeaveStateMachine) {}

  async createRequest(tenantId: string, createLeaveDto: CreateLeaveDto) {
    const start = new Date(createLeaveDto.startDate);
    const end = new Date(createLeaveDto.endDate);

    if (end < start) {
      throw new BadRequestException('End date cannot be before start date.');
    }

    return this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: createLeaveDto.employeeId,
        leaveTypeId: createLeaveDto.leaveType, 
        startDate: start,
        endDate: end,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async getMyRequests(tenantId: string, employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
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

    // Delegate business rule enforcement to the State Machine
    this.leaveStateMachine.validateTransition(
      leave, 
      approveLeaveDto.status as unknown as LeaveStatus, 
      approveLeaveDto.managerEmployeeId, 
      isTenantAdmin
    );

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: approveLeaveDto.status as any,
        approvedAt: new Date(),
      },
    });
  }
}

