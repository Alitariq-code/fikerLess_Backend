import { IsString, IsOptional, IsBoolean, IsEnum, IsEmail, MinLength, IsArray } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum(['user', 'specialist', 'admin'])
  user_type?: string;

  @IsOptional()
  @IsBoolean()
  is_email_verified?: boolean;

  @IsOptional()
  @IsBoolean()
  is_disabled?: boolean;

  @IsOptional()
  demographics?: {
    age_range?: string;
    gender_identity?: string;
    country_of_residence?: string;
    relationship_status?: string;
    what_brings_you_here?: string[];
    other_reason?: string;
    goals_for_using_app?: string[];
    mental_health_diagnosis?: string;
    diagnosed_conditions?: string[];
    seeing_professional?: string;
    suicidal_thoughts?: string;
    exercise_frequency?: string;
    substance_use?: string;
    support_system?: string;
    preferred_support_type?: string[];
    preferred_therapist_gender?: string;
    preferred_language?: string;
    understands_emergency_disclaimer?: boolean;
  };
}

