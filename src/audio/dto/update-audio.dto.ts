import { IsString, IsEnum, IsNumber, IsBoolean, IsOptional, MinLength, Min } from 'class-validator';
import { AudioLanguage, AudioCategory } from '../../models/schemas/audio.schema';

export class UpdateAudioDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Title cannot be empty' })
  title?: string;

  @IsOptional()
  @IsEnum(AudioLanguage, { message: 'Invalid language' })
  language?: AudioLanguage;

  @IsOptional()
  @IsEnum(AudioCategory, { message: 'Invalid category' })
  category?: AudioCategory;

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

