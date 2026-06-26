import { IsString, IsOptional } from 'class-validator';

export class RunPayrollDto {
  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  payPeriod?: string;

  get payPeriodValue(): string {
    return this.payPeriod || this.period || '';
  }
}
