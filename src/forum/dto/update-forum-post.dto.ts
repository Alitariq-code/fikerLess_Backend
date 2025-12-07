import { IsString, IsOptional, IsEnum, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { ArticleCategory } from '../../models/schemas/article.schema';

export class UpdateForumPostDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description?: string;

  @IsOptional()
  @IsEnum(ArticleCategory, { message: 'Invalid category' })
  category?: ArticleCategory;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;
}

