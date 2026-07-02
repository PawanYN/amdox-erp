import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIntercompanyTransferDto {
  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  toAccountId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
