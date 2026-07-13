import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveGoodsLineDto {
  @IsString()
  purchaseOrderLineId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class ReceiveGoodsDto {
  @IsString()
  warehouseId: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /**
   * Per-line quantities actually delivered in this receipt. Omit to receive
   * every line's full remaining (ordered − already-received) quantity in one
   * shot — the pre-existing one-click behaviour every current caller relies on.
   */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReceiveGoodsLineDto)
  lines?: ReceiveGoodsLineDto[];
}
