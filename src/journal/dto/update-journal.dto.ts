import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { JournalMood } from '../../models/schemas/journal.schema';

export class UpdateJournalDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Journal content cannot be empty' })
  @MaxLength(10000, { message: 'Journal content must not exceed 10000 characters' })
  content?: string;

  @IsOptional()
  @IsEnum(JournalMood, { message: 'Invalid mood value' })
  mood?: JournalMood;
}

