import { IsBoolean, IsArray, ArrayNotEmpty, IsMongoId, IsOptional } from 'class-validator';

export class BroadcastNotificationDto {
  @IsMongoId()
  template_id: string;

  @IsBoolean()
  @IsOptional()
  send_to_all?: boolean;

  @IsArray()
  @IsMongoId({ each: true })
  @ArrayNotEmpty()
  @IsOptional()
  user_ids?: string[];
}

