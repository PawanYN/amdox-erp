import { IsNumber, IsUUID, IsOptional, IsString } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  bankReference?: string;
}
