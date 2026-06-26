import { IsString, IsNotEmpty, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LeaveType {
  ANNUAL = 'annual',
  SICK = 'sick',
  MATERNITY = 'maternity',
  UNPAID = 'unpaid',
}

export class CreateLeaveDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Your Employee ID' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ enum: LeaveType, example: LeaveType.ANNUAL })
  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @ApiProperty({ example: '2026-07-01', description: 'ISO Date string' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2026-07-05', description: 'ISO Date string' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: 'Going on vacation' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
