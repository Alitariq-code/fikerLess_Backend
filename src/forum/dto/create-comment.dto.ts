import { IsString, IsNotEmpty, IsOptional, IsBoolean, MinLength, MaxLength, IsMongoId } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty({ message: 'Comment content is required' })
  @IsString()
  @MinLength(1, { message: 'Comment must not be empty' })
  @MaxLength(1000, { message: 'Comment must not exceed 1000 characters' })
  content: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @IsOptional()
  @IsMongoId({ message: 'Invalid parent comment ID format' })
  parent_comment_id?: string;
}

