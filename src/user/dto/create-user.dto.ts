import { IsString, IsOptional, IsBoolean, IsEnum, IsEmail, MinLength, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

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

  @IsEnum(['user', 'specialist', 'admin'], { message: 'User type must be user, specialist, or admin' })
  user_type: string;

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

  @IsOptional()
  specialist_profile?: {
    full_name?: string;
    designation?: string;
    location?: string;
    hourly_rate?: number;
    currency?: string;
    specializations?: string[];
    languages?: string[];
    categories?: string[];
    experience_years?: number;
    profile_photo?: string;
    education?: Array<{ degree: string; institute_name: string }>;
    certifications?: Array<{ certificate_title: string; provider: string }>;
    is_verified?: boolean;
  };
}

