import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationTemplateDocument = NotificationTemplate & Document;

@Schema({ collection: 'notification_templates', timestamps: true })
export class NotificationTemplate {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ default: 'general' })
  type: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop()
  cta_text?: string;

  @Prop()
  cta_url?: string;

  @Prop()
  schedule_at?: Date;

  @Prop({ default: true })
  is_active: boolean;
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);

NotificationTemplateSchema.index({ type: 1, createdAt: -1 });

