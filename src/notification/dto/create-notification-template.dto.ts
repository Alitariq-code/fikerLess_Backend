import { IsString, IsOptional, IsObject, IsDateString, IsBoolean } from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

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

