import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EducationDto {
  @IsString()
  degree: string;

  @IsString()
  institute_name: string;
}

export class CertificationDto {
  @IsString()
  certificate_title: string;

  @IsString()
  provider: string;
}

export class BasicInfoDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  hourly_rate?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specializations?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  experience_years?: number;

  @IsString()
  @IsOptional()
  profile_photo?: string;
}

export class CreateSpecialistProfileDto {
  @ValidateNested()
  @Type(() => BasicInfoDto)
  basic_info: BasicInfoDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  @IsOptional()
  education?: EducationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  @IsOptional()
  certifications?: CertificationDto[];
}

