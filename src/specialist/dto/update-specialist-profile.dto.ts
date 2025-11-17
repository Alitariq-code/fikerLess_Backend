import { IsString, IsNumber, IsArray, IsOptional, IsBoolean, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BasicInfoDto, EducationDto, CertificationDto } from './create-specialist-profile.dto';

export class UpdateSpecialistProfileDto {
  @ValidateNested()
  @Type(() => BasicInfoDto)
  @IsOptional()
  basic_info?: BasicInfoDto;

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

  @IsBoolean()
  @IsOptional()
  profile_completed?: boolean;
}

