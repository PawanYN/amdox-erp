import { IsString, IsEmail, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  @ApiProperty({ example: 'admin@acmecorp.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(8)
  adminPassword: string;
}
