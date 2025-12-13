import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type UserPlantDocument = UserPlant & Document;

@Schema({ collection: 'user_plants', timestamps: true })
export class UserPlant {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: Number, default: 1, min: 1, max: 6 })
  current_level: number;

  @Prop({ type: Number, default: 0 })
  total_xp: number;

  @Prop({ type: Date })
  last_level_up_date?: Date;
}

export const UserPlantSchema = SchemaFactory.createForClass(UserPlant);

UserPlantSchema.index({ user_id: 1 }, { unique: true });
UserPlantSchema.index({ current_level: 1 });

