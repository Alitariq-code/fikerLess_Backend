import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type StepsDocument = Steps & Document;

@Schema({ collection: 'steps', timestamps: true })
export class Steps {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, type: Number })
  steps: number;

  @Prop({ required: true, type: Date, index: true })
  date: Date;

  @Prop({ type: Number })
  calories_burned?: number;

  @Prop({ type: Number })
  distance_km?: number;

  @Prop({ type: Number, default: 10000 })
  goal?: number;
}

export const StepsSchema = SchemaFactory.createForClass(Steps);

StepsSchema.index({ user_id: 1, date: -1 });
StepsSchema.index({ user_id: 1, created_at: -1 });

