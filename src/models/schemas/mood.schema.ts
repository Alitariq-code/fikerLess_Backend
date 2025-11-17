import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MoodDocument = Mood & Document;

@Schema({ collection: 'moods', timestamps: true })
export class Mood {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string;

  @Prop({
    type: String,
    enum: ['happy', 'sad', 'anxious', 'tired', 'angry', 'calm'],
    required: true,
  })
  mood: string;

  @Prop()
  journal_entry?: string;
}

export const MoodSchema = SchemaFactory.createForClass(Mood);

MoodSchema.index({ user_id: 1, date: 1 }, { unique: true });
MoodSchema.index({ user_id: 1, created_at: -1 });

