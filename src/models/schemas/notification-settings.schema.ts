import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type NotificationSettingsDocument = NotificationSettings & Document;

@Schema({ collection: 'notification_settings', timestamps: true })
export class NotificationSettings {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ default: true })
  email_notifications: boolean;

  @Prop({ default: false })
  sms_notifications: boolean;

  @Prop({ default: true })
  appointment_reminders: boolean;

  @Prop({ default: true })
  payment_notifications: boolean;
}

export const NotificationSettingsSchema = SchemaFactory.createForClass(NotificationSettings);
NotificationSettingsSchema.index({ user_id: 1 }, { unique: true });

