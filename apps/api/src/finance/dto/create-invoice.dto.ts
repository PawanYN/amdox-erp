import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsEnum, ValidateNested, ArrayMinSize, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceType {
  AP = 'AP',
  AR = 'AR'
}

export class CreateInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  lineTotal: number;
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @IsDateString()
  issueDate: Date;

  @IsDateString()
  dueDate: Date;

  @IsNumber()
  totalAmount: number;

  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineDto)
  @ArrayMinSize(1)
  lines: CreateInvoiceLineDto[];
}
