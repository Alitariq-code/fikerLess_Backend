import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type DemographicsDocument = Demographics & Document;

@Schema({ collection: 'demographics', timestamps: true })
export class Demographics {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  user_id: Types.ObjectId;

  @Prop()
  age_range?: string;

  @Prop()
  gender_identity?: string;

  @Prop()
  country_of_residence?: string;

  @Prop()
  relationship_status?: string;

  @Prop({ type: [String] })
  what_brings_you_here?: string[];

  @Prop()
  other_reason?: string;

  @Prop({ type: [String] })
  goals_for_using_app?: string[];

  @Prop()
  mental_health_diagnosis?: string;

  @Prop({ type: [String] })
  diagnosed_conditions?: string[];

  @Prop()
  seeing_professional?: string;

  @Prop()
  suicidal_thoughts?: string;

  @Prop()
  exercise_frequency?: string;

  @Prop()
  substance_use?: string;

  @Prop()
  support_system?: string;

  @Prop({ type: [String] })
  preferred_support_type?: string[];

  @Prop()
  preferred_therapist_gender?: string;

  @Prop()
  preferred_language?: string;

  @Prop({ default: false })
  understands_emergency_disclaimer: boolean;
}

export const DemographicsSchema = SchemaFactory.createForClass(Demographics);

DemographicsSchema.index({ user_id: 1 });
DemographicsSchema.index({ created_at: 1 });

