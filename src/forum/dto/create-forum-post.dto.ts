import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ArticleCategory } from '../../models/schemas/article.schema';

export class CreateForumPostDto {
  @IsNotEmpty({ message: 'Title is required' })
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsNotEmpty({ message: 'Description is required' })
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description: string;

  @IsOptional()
  @IsEnum(ArticleCategory, { message: 'Invalid category' })
  category?: ArticleCategory;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}

