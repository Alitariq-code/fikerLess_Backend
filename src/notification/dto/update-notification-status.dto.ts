import { IsString, IsIn } from 'class-validator';

export class UpdateNotificationStatusDto {
  @IsString()
  @IsIn(['read', 'unread', 'archived'])
  status: 'read' | 'unread' | 'archived';
}

