import { IsString, IsDateString } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  name: string;

  @IsDateString()
  dueDate: string;
}
