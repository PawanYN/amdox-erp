import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceType {
  AP = 'AP',
  AR = 'AR',
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

  /**
   * Optional: which product this line is for. Set automatically when the
   * invoice is auto-generated from a PO/goods receipt; left blank for
   * OCR-extracted lines where product resolution wasn't attempted. Enables
   * line-level (not just header-total) 3-way matching when present.
   */
  @IsOptional()
  @IsUUID()
  productId?: string;
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
