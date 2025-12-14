import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, MinLength, Min, Max } from 'class-validator';
import { AudioLanguage, AudioCategory } from '../../models/schemas/audio.schema';

export class CreateAudioDto {
  @IsString()
  @MinLength(1, { message: 'Title is required' })
  title: string;

  @IsEnum(AudioLanguage, { message: 'Invalid language' })
  language: AudioLanguage;

  @IsEnum(AudioCategory, { message: 'Invalid category' })
  category: AudioCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Order cannot be negative' })
  order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

