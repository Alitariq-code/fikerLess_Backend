import { IsString, IsOptional, IsObject, IsDateString, IsBoolean } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  cta_text?: string;

  @IsString()
  @IsOptional()
  cta_url?: string;

  @IsDateString()
  @IsOptional()
  schedule_at?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

