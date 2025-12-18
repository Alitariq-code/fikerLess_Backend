import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveSessionRequestDto {
  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  @MaxLength(1000, { message: 'Notes must not exceed 1000 characters' })
  notes?: string;
}

