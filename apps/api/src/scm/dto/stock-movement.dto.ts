import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum StockMovementType {
  RECEIPT = 'RECEIPT',
  ISSUE = 'ISSUE',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
}

export class CreateStockMovementDto {
  @IsString()
  productId: string;

  @IsString()
  warehouseId: string;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  reference?: string;
}
