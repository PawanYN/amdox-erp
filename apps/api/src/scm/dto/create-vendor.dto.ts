import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  webhookUrl?: string;
}
