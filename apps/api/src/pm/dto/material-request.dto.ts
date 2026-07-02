import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MaterialRequestLineDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsNumber()
  estimatedUnitPrice?: number;
}

export class MaterialRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MaterialRequestLineDto)
  lines: MaterialRequestLineDto[];
}
