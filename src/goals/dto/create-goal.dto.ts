import { IsString, IsNotEmpty, IsEnum, IsOptional, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { GoalCategory, GoalFrequency } from '../../models/schemas/goal.schema';

export class CreateGoalDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @MinLength(1, { message: 'Title must be at least 1 character long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsEnum(GoalCategory, { message: 'Invalid category. Must be one of: Exercise, Read an Article, Meditation, Mood Tracking, Other' })
  category: GoalCategory;

  @ValidateIf((o) => o.category === 'Other')
  @IsNotEmpty({ message: 'custom_category is required when category is "Other"' })
  @IsString()
  @IsOptional()
  custom_category?: string;

  @IsNotEmpty({ message: 'Frequency is required' })
  @IsEnum(GoalFrequency, { message: 'Invalid frequency. Must be Daily or Weekly' })
  frequency: GoalFrequency;

  @IsOptional()
  target_streak?: number;
}


