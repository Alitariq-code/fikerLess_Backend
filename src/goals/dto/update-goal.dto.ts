import { IsString, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { GoalCategory, GoalFrequency } from '../../models/schemas/goal.schema';

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title must be at least 1 character long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsEnum(GoalCategory, { message: 'Invalid category' })
  category?: GoalCategory;

  @IsOptional()
  @IsEnum(GoalFrequency, { message: 'Invalid frequency' })
  frequency?: GoalFrequency;

  @IsOptional()
  target_streak?: number;
}


