import { IsString, IsNotEmpty } from 'class-validator';

export class UpsertFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcm_token: string;
}

