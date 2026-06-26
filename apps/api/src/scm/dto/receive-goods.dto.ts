import { IsString, IsOptional } from 'class-validator';

export class ReceiveGoodsDto {
  @IsString()
  warehouseId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
