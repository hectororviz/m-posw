import { IsInt } from 'class-validator';

export class AssignCoachDto {
  @IsInt()
  coachId: number;

  @IsInt()
  playerCategoryId: number;
}
