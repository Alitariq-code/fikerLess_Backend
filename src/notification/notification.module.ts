import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationAdminController } from './notification-admin.controller';
import { FcmNotificationController } from './fcm-notification.controller';
import { NotificationService } from './notification.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationTemplate, NotificationTemplateSchema } from '../models/schemas/notification-template.schema';
import { UserNotification, UserNotificationSchema } from '../models/schemas/user-notification.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { FcmToken, FcmTokenSchema } from '../models/schemas/fcm-token.schema';
import { NotificationSettings, NotificationSettingsSchema } from '../models/schemas/notification-settings.schema';
import { Session, SessionSchema } from '../models/schemas/session.schema';
import { SessionRequest, SessionRequestSchema } from '../models/schemas/session-request.schema';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: UserNotification.name, schema: UserNotificationSchema },
      { name: User.name, schema: UserSchema },
      { name: FcmToken.name, schema: FcmTokenSchema },
      { name: NotificationSettings.name, schema: NotificationSettingsSchema },
      { name: Session.name, schema: SessionSchema },
      { name: SessionRequest.name, schema: SessionRequestSchema },
    ]),
    FirebaseModule,
  ],
  controllers: [NotificationController, NotificationAdminController, FcmNotificationController],
  providers: [NotificationService, NotificationSchedulerService],
  exports: [NotificationService],
})
export class NotificationModule {}

