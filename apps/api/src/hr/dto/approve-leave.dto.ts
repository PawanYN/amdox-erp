import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum LeaveStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class ApproveLeaveDto {
  @ApiProperty({ enum: LeaveStatus, example: LeaveStatus.APPROVED })
  @IsEnum(LeaveStatus)
  @IsNotEmpty()
  status: LeaveStatus;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Manager Employee ID performing the approval' })
  @IsString()
  @IsNotEmpty()
  managerEmployeeId: string;
}
