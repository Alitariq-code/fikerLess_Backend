import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type SpecialistProfileDocument = SpecialistProfile & Document;

@Schema({ collection: 'specialist_profiles', timestamps: true })
export class SpecialistProfile {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  full_name: string;

  @Prop({ required: true })
  designation: string;

  @Prop({ required: true })
  location: string;

  @Prop({ required: true, type: Number })
  hourly_rate: number;

  @Prop({ required: true, default: 'PKR' })
  currency: string;

  @Prop({ type: [String], default: [] })
  specializations: string[];

  @Prop({ type: [String], default: [] })
  languages: string[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ type: Number, default: 0 })
  rating: number;

  @Prop({ type: Number, default: 0 })
  total_reviews: number;

  @Prop({ type: Number, default: 0 })
  experience_years: number;

  @Prop()
  profile_photo?: string;

  @Prop({ type: [{ degree: String, institute_name: String }], default: [] })
  education: Array<{ degree: string; institute_name: string }>;

  @Prop({ type: [{ certificate_title: String, provider: String }], default: [] })
  certifications: Array<{ certificate_title: string; provider: string }>;

  @Prop({ default: false })
  profile_completed: boolean;

  @Prop({ default: false })
  is_verified: boolean;
}

export const SpecialistProfileSchema = SchemaFactory.createForClass(SpecialistProfile);

SpecialistProfileSchema.index({ user_id: 1 });
SpecialistProfileSchema.index({ specializations: 1 });
SpecialistProfileSchema.index({ categories: 1 });
SpecialistProfileSchema.index({ location: 1 });
SpecialistProfileSchema.index({ is_verified: 1 });

