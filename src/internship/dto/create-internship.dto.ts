import { IsString, IsArray, IsOptional, IsNumber, Min, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ProgramDto {
  @IsString()
  @MinLength(1, { message: 'Program title is required' })
  title: string;

  @IsString()
  @MinLength(1, { message: 'Program duration is required' })
  duration: string;

  @IsNumber()
  @Min(0, { message: 'Fees must be 0 or greater' })
  fees: number;

  @IsString()
  @IsOptional()
  mode?: string; // 'online', 'in-person', 'hybrid'

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateInternshipDto {
  @IsString()
  @MinLength(2, { message: 'Mentor name must be at least 2 characters' })
  @MaxLength(100, { message: 'Mentor name must not exceed 100 characters' })
  mentorName: string;

  @IsString()
  @MinLength(2, { message: 'Profession must be at least 2 characters' })
  @MaxLength(100, { message: 'Profession must not exceed 100 characters' })
  profession: string;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Specialization must not exceed 200 characters' })
  specialization?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDto)
  programs: ProgramDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  includes?: string[];

  @IsString()
  @MinLength(2, { message: 'City must be at least 2 characters' })
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  city: string;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'City note must not exceed 500 characters' })
  cityNote?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Additional info must not exceed 1000 characters' })
  additionalInfo?: string;

  @IsOptional()
  is_active?: boolean;
}

