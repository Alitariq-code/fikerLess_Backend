import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'English quote cannot be empty' })
  quote_english?: string;

  @IsOptional()
  @IsString()
  quote_urdu?: string;

  @IsOptional()
  @IsString()
  quranic_verse?: string;

  @IsOptional()
  @IsBoolean()
  is_today_quote?: boolean;
}

