import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TransitionRequestDto {
  @IsString()
  @IsNotEmpty()
  transitionLabel: string;

  @IsString()
  @IsOptional()
  comments?: string;
}

export class TransitionResponseDto {
  previousStateId: string;
  previousStateLabel: string;
  newStateId: string;
  newStateLabel: string;
  transitionLabel: string;
  transitionExecutedAt: Date;
  conditionsEvaluated: any[];
  actionsExecuted: any[];
}
