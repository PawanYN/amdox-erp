import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class RunPaymentBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  invoiceIds: string[];

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
