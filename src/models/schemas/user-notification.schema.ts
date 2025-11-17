import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationTemplate } from './notification-template.schema';
import { User } from './user.schema';

export type UserNotificationDocument = UserNotification & Document;

@Schema({ collection: 'user_notifications', timestamps: true })
export class UserNotification {
  @Prop({ type: Types.ObjectId, ref: NotificationTemplate.name, required: true })
  template_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread',
    index: true,
  })
  status: string;

  @Prop()
  read_at?: Date;

  @Prop()
  deleted_at?: Date;

  @Prop({ type: Object, default: {} })
  payload: {
    title: string;
    body: string;
    type?: string;
    metadata?: Record<string, any>;
    cta_text?: string;
    cta_url?: string;
  };
}

export const UserNotificationSchema = SchemaFactory.createForClass(UserNotification);

UserNotificationSchema.index({ template_id: 1, user_id: 1 }, { unique: true });
UserNotificationSchema.index({ user_id: 1, status: 1, createdAt: -1 });

