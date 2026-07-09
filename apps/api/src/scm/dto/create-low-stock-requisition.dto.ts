import { IsUUID } from 'class-validator';

export class CreateLowStockRequisitionDto {
  @IsUUID()
  productId: string;
}
