import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type JournalDocument = Journal & Document;

export enum JournalMood {
  HAPPY = 'happy',
  SAD = 'sad',
  ANXIOUS = 'anxious',
  TIRED = 'tired',
  ANGRY = 'angry',
  CALM = 'calm',
  NEUTRAL = 'neutral',
}

@Schema({ collection: 'journals', timestamps: true })
export class Journal {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, index: true })
  date: string; // Format: YYYY-MM-DD

  @Prop({ required: true, minlength: 1, maxlength: 10000 })
  content: string;

  @Prop({
    type: String,
    enum: Object.values(JournalMood),
    default: JournalMood.NEUTRAL,
    index: true,
  })
  mood?: JournalMood;
}

export const JournalSchema = SchemaFactory.createForClass(Journal);

// Ensure one journal entry per user per date
JournalSchema.index({ user_id: 1, date: 1 }, { unique: true });
JournalSchema.index({ user_id: 1, createdAt: -1 });
JournalSchema.index({ user_id: 1, date: -1 });

