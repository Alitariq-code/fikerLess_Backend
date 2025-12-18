import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { AvailabilityRule, AvailabilityRuleSchema } from '../models/schemas/availability-rule.schema';
import { AvailabilitySettings, AvailabilitySettingsSchema } from '../models/schemas/availability-settings.schema';
import { AvailabilityOverride, AvailabilityOverrideSchema } from '../models/schemas/availability-override.schema';
import { SessionRequest, SessionRequestSchema } from '../models/schemas/session-request.schema';
import { BlockedSlot, BlockedSlotSchema } from '../models/schemas/blocked-slot.schema';
import { Session, SessionSchema } from '../models/schemas/session.schema';
import { User, UserSchema } from '../models/schemas/user.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AvailabilityRule.name, schema: AvailabilityRuleSchema },
      { name: AvailabilitySettings.name, schema: AvailabilitySettingsSchema },
      { name: AvailabilityOverride.name, schema: AvailabilityOverrideSchema },
      { name: SessionRequest.name, schema: SessionRequestSchema },
      { name: BlockedSlot.name, schema: BlockedSlotSchema },
      { name: Session.name, schema: SessionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}

