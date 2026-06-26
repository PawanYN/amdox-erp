import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpsertReorderRuleDto {
  @IsString()
  productId: string;

  @IsNumber()
  thresholdQty: number;

  @IsNumber()
  reorderQty: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
