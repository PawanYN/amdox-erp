import { IsString, IsDateString, IsOptional } from 'class-validator';

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
