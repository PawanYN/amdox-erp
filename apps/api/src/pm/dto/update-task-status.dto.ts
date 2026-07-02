import { IsEnum } from 'class-validator';
import { TaskStatus } from '@amdox/db';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;
}
