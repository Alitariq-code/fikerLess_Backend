import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class NotificationRequestDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}

