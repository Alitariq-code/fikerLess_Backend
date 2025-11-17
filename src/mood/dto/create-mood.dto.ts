import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';

export enum MoodType {
  HAPPY = 'happy',
  SAD = 'sad',
  ANXIOUS = 'anxious',
  TIRED = 'tired',
  ANGRY = 'angry',
  CALM = 'calm',
}

export class CreateMoodDto {
  @IsEnum(MoodType)
  mood: MoodType;

  @IsString()
  @IsOptional()
  journal_entry?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsOptional()
  date?: string;
}

