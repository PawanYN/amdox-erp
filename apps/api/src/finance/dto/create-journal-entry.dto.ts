import { IsString, IsNotEmpty, IsOptional, IsNumber, ArrayMinSize, ValidateNested, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJournalLineDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  debit: number;

  @IsNumber()
  credit: number;
}

export class CreateJournalEntryDto {
  @IsUUID()
  fiscalPeriodId: string;

  @IsString()
  @IsNotEmpty()
  reference: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sourceModule?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  @ArrayMinSize(2)
  lines: CreateJournalLineDto[];
}
