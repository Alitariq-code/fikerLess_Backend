import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Comment must not be empty' })
  @MaxLength(1000, { message: 'Comment must not exceed 1000 characters' })
  content?: string;
}

