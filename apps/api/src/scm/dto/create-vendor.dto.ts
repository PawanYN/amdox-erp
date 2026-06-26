import { IsString, IsEmail, IsOptional, IsUrl } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsUrl()
  @IsOptional()
  webhookUrl?: string;
}
