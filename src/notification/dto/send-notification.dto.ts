import { IsString, IsOptional, IsMongoId, IsBoolean, IsArray, ArrayNotEmpty, IsObject } from 'class-validator';

export class SendNotificationDto {
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

  // For single user
  @IsMongoId()
  @IsOptional()
  user_id?: string;

  // For broadcast
  @IsBoolean()
  @IsOptional()
  send_to_all?: boolean;

  @IsArray()
  @IsMongoId({ each: true })
  @ArrayNotEmpty()
  @IsOptional()
  user_ids?: string[];
}

