import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ClockInSource {
  MANUAL = 'manual',
  BIOMETRIC = 'biometric',
  API = 'api',
}

export class ClockInDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ enum: ClockInSource, example: ClockInSource.API })
  @IsEnum(ClockInSource)
  @IsNotEmpty()
  source: ClockInSource;
}
