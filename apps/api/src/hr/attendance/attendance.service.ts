import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { ClockInDto } from '../dto/clock-in.dto';

@Injectable()
export class AttendanceService {
  private prisma = new PrismaClient();

  async clockIn(tenantId: string, clockInDto: ClockInDto) {
    const now = new Date();
    // Normalize to precisely midnight of today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Prevent double clock-ins on the exact same day using range on clockIn
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: {
        tenantId,
        employeeId: clockInDto.employeeId,
        clockIn: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Employee has already clocked in for today.');
    }

    return this.prisma.attendanceRecord.create({
      data: {
        tenantId,
        employeeId: clockInDto.employeeId,
        clockIn: now,
      },
    });
  }

  async clockOut(tenantId: string, employeeId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const attendance = await this.prisma.attendanceRecord.findFirst({
      where: { 
        tenantId, 
        employeeId, 
        clockIn: {
          gte: startOfDay,
          lt: endOfDay,
        }
      },
    });

    if (!attendance) {
      throw new NotFoundException('No active clock-in record found for today.');
    }
    
    // Enforcement of Business Rule #3: If they forget, it stays null, but they can't clock out twice!
    if (attendance.clockOut) {
      throw new BadRequestException('Employee has already clocked out for today.');
    }

    // Enforcement of Business Rule #2: Calculate Overtime past 8 hours
    const diffMs = now.getTime() - attendance.clockIn.getTime();
    const hoursWorked = diffMs / (1000 * 60 * 60);
    const overtimeHours = hoursWorked > 8 ? hoursWorked - 8 : 0;

    return this.prisma.attendanceRecord.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        overtimeMins: Math.round(overtimeHours * 60),
      },
    });
  }
}
