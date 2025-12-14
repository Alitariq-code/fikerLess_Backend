import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, MinLength, Min } from 'class-validator';
import { AchievementCategory, AchievementConditionType } from '../../models/schemas/achievement.schema';

export class CreateAchievementDto {
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  name: string;

  @IsString()
  @MinLength(1, { message: 'Description is required' })
  description: string;

  @IsString()
  @MinLength(1, { message: 'Icon is required' })
  icon: string;

  @IsEnum(AchievementCategory, { message: 'Invalid category' })
  category: AchievementCategory;

  @IsEnum(AchievementConditionType, { message: 'Invalid condition type' })
  condition_type: AchievementConditionType;

  @IsNumber()
  @Min(1, { message: 'Condition value must be at least 1' })
  condition_value: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'XP reward cannot be negative' })
  xp_reward?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Order cannot be negative' })
  order?: number;
}

