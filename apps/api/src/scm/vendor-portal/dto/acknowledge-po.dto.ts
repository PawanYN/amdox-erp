import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AcknowledgePoDto {
  @IsDateString()
  @IsOptional()
  expectedDeliveryAt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
