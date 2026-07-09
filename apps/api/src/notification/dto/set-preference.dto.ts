import { IsBoolean, IsEnum, IsString } from 'class-validator';
import { NotificationChannel } from '@amdox/db';

export class SetPreferenceDto {
  @IsString()
  eventType: string;

  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @IsBoolean()
  isEnabled: boolean;
}
