import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsUUID,
  IsDateString,
  IsEnum,
  IsObject,
  IsBoolean,
  IsIn,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ASSIGNABLE_MODULES } from '../../auth/erp-modules';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
}

/** ERP access role — maps to DB Role.name and Keycloak realm role. */
export const EMPLOYEE_SYSTEM_ROLES = ['TenantAdmin', 'Manager', 'Viewer', 'Employee'] as const;
export type EmployeeSystemRole = (typeof EMPLOYEE_SYSTEM_ROLES)[number];

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

  @ApiPropertyOptional({ example: 'Senior Accountant' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Manager ID',
  })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiPropertyOptional({
    example: { bankName: 'Chase', accountNumber: '123456789' },
    description: 'JSON object for bank details',
  })
  @IsOptional()
  @IsObject()
  bankDetails?: any;

  @ApiPropertyOptional({
    example: 65000,
    description:
      "Monthly gross salary. Creates/updates the employee's EmploymentContract, which payroll runs read from — without this, the employee is skipped by payroll.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR', description: 'Salary currency code' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({
    example: 'Manager',
    description: 'ERP system role for login access (defaults to Employee)',
    enum: EMPLOYEE_SYSTEM_ROLES,
  })
  @IsOptional()
  @IsIn(EMPLOYEE_SYSTEM_ROLES)
  systemRole?: EmployeeSystemRole;

  @ApiPropertyOptional({
    default: true,
    description: 'When false, only the HR employee record is created — no Keycloak/DB user',
  })
  @IsOptional()
  @IsBoolean()
  provideErpAccess?: boolean;

  @ApiPropertyOptional({
    example: ['projects', 'finance'],
    description:
      'ERP sidebar modules for this person. When omitted or empty, inherits from their department.',
    enum: ASSIGNABLE_MODULES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(ASSIGNABLE_MODULES, { each: true })
  allowedModules?: string[];
}
