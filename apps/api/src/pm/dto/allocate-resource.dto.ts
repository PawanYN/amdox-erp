import { IsOptional, IsDateString, IsUUID, IsNumber, Min } from 'class-validator';

export class AllocateResourceDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsUUID()
  employeeId: string;

  @IsNumber()
  @Min(0.5)
  allocatedHours: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
