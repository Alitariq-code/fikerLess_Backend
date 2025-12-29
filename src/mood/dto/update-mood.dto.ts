import { IsString, IsEnum, IsOptional, ValidateIf, IsNotEmpty } from 'class-validator';
import { MoodType } from './create-mood.dto';

export class UpdateMoodDto {
  @IsEnum(MoodType)
  @IsOptional()
  mood?: MoodType;

  @ValidateIf((o) => o.mood === 'other')
  @IsNotEmpty({ message: 'custom_mood is required when mood is "other"' })
  @IsString()
  @IsOptional()
  custom_mood?: string;

  @IsString()
  @IsOptional()
  journal_entry?: string;
}

