import { IsString, IsEnum, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';
import { ArticleCategory, ArticleStatus } from '../../models/schemas/article.schema';

export class CreateArticleDto {
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title: string;

  @IsEnum(ArticleCategory, { message: 'Invalid category' })
  category: ArticleCategory;

  @IsString()
  @MinLength(50, { message: 'Content must be at least 50 characters long' })
  content: string;

  @IsOptional()
  @IsUrl({}, { message: 'Featured image must be a valid URL' })
  featured_image_url?: string;

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
}

