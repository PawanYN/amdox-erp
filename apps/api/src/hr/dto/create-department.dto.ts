import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ERP_MODULES } from '../../auth/erp-modules';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HR' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({
    example: ['hr'],
    description: 'ERP modules employees in this department can access',
    enum: ERP_MODULES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(ERP_MODULES, { each: true })
  allowedModules?: string[];

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Employee ID of the department head',
  })
  @IsOptional()
  @IsUUID()
  headId?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Parent Department ID for nested hierarchies',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
