import { IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';

export class SetBudgetDto {
  @IsUUID()
  projectId: string;

  @IsNumber()
  @Min(0)
  plannedAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  overrunThresholdPct?: number; 
}
