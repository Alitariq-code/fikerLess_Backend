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
  full_name: string;

  @IsString()
  designation: string;

  @IsString()
  location: string;

  @IsNumber()
  @Min(0)
  hourly_rate: number;

  @IsString()
  currency: string;

  @IsArray()
  @IsString({ each: true })
  specializations: string[];

  @IsArray()
  @IsString({ each: true })
  languages: string[];
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

