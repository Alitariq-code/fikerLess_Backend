import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type FcmTokenDocument = FcmToken & Document;

@Schema({ collection: 'fcm_tokens', timestamps: true })
export class FcmToken {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  fcm_token: string;
}

export const FcmTokenSchema = SchemaFactory.createForClass(FcmToken);

FcmTokenSchema.index({ user_id: 1 }, { unique: true });

