import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationAdminController } from './notification-admin.controller';
import { NotificationService } from './notification.service';
import { NotificationTemplate, NotificationTemplateSchema } from '../models/schemas/notification-template.schema';
import { UserNotification, UserNotificationSchema } from '../models/schemas/user-notification.schema';
import { User, UserSchema } from '../models/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationController, NotificationAdminController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

