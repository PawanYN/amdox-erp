import { IsString, IsNotEmpty, IsEmail, IsOptional, IsUUID, IsDateString, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+1-555-0198' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '1990-05-15', description: 'ISO Date string' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty({ example: '2026-06-25', description: 'ISO Date string' })
  @IsDateString()
  @IsNotEmpty()
  hireDate: string;

  @ApiPropertyOptional({ enum: EmploymentType, example: EmploymentType.FULL_TIME })
  @IsEnum(EmploymentType)
  @IsNotEmpty()
  employmentType: EmploymentType;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Manager ID' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({ example: { bankName: 'Chase', accountNumber: '123456789' }, description: 'JSON object for bank details' })
  @IsOptional()
  @IsObject()
  bankDetails?: any;
}
