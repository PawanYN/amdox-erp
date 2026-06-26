import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HR-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Employee ID of the department head' })
  @IsOptional()
  @IsUUID()
  headId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Parent Department ID for nested hierarchies' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
