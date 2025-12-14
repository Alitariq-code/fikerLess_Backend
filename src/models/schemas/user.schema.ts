import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  phone_number?: string;

  @Prop({ default: '' })
  otp_token: string;

  @Prop({ default: false })
  is_email_verified: boolean;

  @Prop({ 
    type: String, 
    enum: ['user', 'specialist', 'admin'],
    default: 'user'
  })
  user_type: string;

  @Prop({ default: false })
  has_demographics: boolean;

  @Prop({ default: '' })
  first_name: string;

  @Prop({ default: '' })
  last_name: string;

  @Prop({ unique: true, sparse: true })
  username?: string;

  @Prop({ default: false })
  is_disabled: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ created_at: 1 });

