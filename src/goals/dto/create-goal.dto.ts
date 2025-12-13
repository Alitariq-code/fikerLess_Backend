import { IsString, IsNotEmpty, IsEnum, IsOptional, MinLength, MaxLength } from 'class-validator';
import { GoalCategory, GoalFrequency } from '../../models/schemas/goal.schema';

export class CreateGoalDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @MinLength(1, { message: 'Title must be at least 1 character long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsEnum(GoalCategory, { message: 'Invalid category. Must be one of: Exercise, Read an Article, Meditation, Mood Tracking' })
  category: GoalCategory;

  @IsNotEmpty({ message: 'Frequency is required' })
  @IsEnum(GoalFrequency, { message: 'Invalid frequency. Must be Daily or Weekly' })
  frequency: GoalFrequency;

  @IsOptional()
  target_streak?: number;
}


