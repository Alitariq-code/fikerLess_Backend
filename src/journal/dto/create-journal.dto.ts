import { IsString, IsNotEmpty, IsOptional, IsEnum, MinLength, MaxLength, Matches } from 'class-validator';
import { JournalMood } from '../../models/schemas/journal.schema';

export class CreateJournalDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  date: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1, { message: 'Journal content cannot be empty' })
  @MaxLength(10000, { message: 'Journal content must not exceed 10000 characters' })
  content: string;

  @IsOptional()
  @IsEnum(JournalMood, { message: 'Invalid mood value' })
  mood?: JournalMood;
}

