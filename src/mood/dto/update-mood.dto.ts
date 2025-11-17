import { IsString, IsEnum, IsOptional } from 'class-validator';
import { MoodType } from './create-mood.dto';

export class UpdateMoodDto {
  @IsEnum(MoodType)
  @IsOptional()
  mood?: MoodType;

  @IsString()
  @IsOptional()
  journal_entry?: string;
}

