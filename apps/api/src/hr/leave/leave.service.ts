import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, LeaveStatus } from '@amdox/db';
import { CreateLeaveDto } from '../dto/create-leave.dto';
import { ApproveLeaveDto } from '../dto/approve-leave.dto';

@Injectable()
export class LeaveService {
  private prisma = new PrismaClient();

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
        leaveTypeId: createLeaveDto.leaveType, // Note: In reality we should update the DTO to leaveTypeId
        startDate: start,
        endDate: end,
        status: LeaveStatus.PENDING, // State Machine: Initial state
      },
    });
  }

  async getMyRequests(tenantId: string, employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // STATE MACHINE: Transitions 'PENDING' to 'APPROVED' or 'REJECTED'
  async approveOrReject(tenantId: string, leaveId: string, approveLeaveDto: ApproveLeaveDto, isTenantAdmin: boolean) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { employee: true },
    });

    if (!leave || leave.tenantId !== tenantId) {
      throw new NotFoundException('Leave request not found.');
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(`Cannot change status. Leave is already ${leave.status}.`);
    }

    // Enforcement of Business Rule #1: Only Direct Manager or Admin can approve
    if (!isTenantAdmin && leave.employee.managerId !== approveLeaveDto.managerEmployeeId) {
      throw new ForbiddenException('Only the direct manager can approve this leave request.');
    }

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: approveLeaveDto.status as any,
        approvedAt: new Date(),
      },
    });
  }
}
