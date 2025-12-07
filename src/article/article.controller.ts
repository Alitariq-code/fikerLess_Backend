                                                                                        import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/articles')                                                                                                                                                                                          
export class ArticleController {
  constructor(
    private readonly articleService: ArticleService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    return result.user._id.toString();
  }

  private async ensureSpecialist(token: string): Promise<string> {
    const userId = await this.getUserIdFromToken(token);
    const result = await getUserFromToken(token, this.userModel);
    if (result.user?.user_type !== 'specialist') {
      throw new ForbiddenException('Only specialists can perform this action');
    }
    return userId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createArticle(@Headers('authorization') token: string, @Body() dto: CreateArticleDto) {
    const specialistId = await this.ensureSpecialist(token);
    const article = await this.articleService.createArticle(specialistId, dto);
    return {
      success: true,
      message: 'Article created successfully',
      data: article,
    };
  }

  @Get('my-articles')
  @HttpCode(HttpStatus.OK)
  async getMyArticles(
    @Headers('authorization') token: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const specialistId = await this.ensureSpecialist(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.articleService.getMyArticles(specialistId, status, pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getArticles(
    @Query('category') category?: string,
    @Query('specialist_id') specialistId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.articleService.getArticles(category, specialistId, pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  @Get('featured')
  @HttpCode(HttpStatus.OK)
  async getFeaturedArticles(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 6;
    const articles = await this.articleService.getFeaturedArticles(limitNum);
    return {
      success: true,
      data: articles,
    };
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  async getCategories() {
    const categories = this.articleService.getCategories();
    return {
      success: true,
      data: categories,
    };
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchArticles(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.articleService.searchArticles(query || '', pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getArticleById(@Param('id') id: string) {
    const article = await this.articleService.getArticleById(id);
    return {
      success: true,
      data: article,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateArticle(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    const specialistId = await this.ensureSpecialist(token);
    const article = await this.articleService.updateArticle(specialistId, id, dto);
    return {
      success: true,
      message: 'Article updated successfully',
      data: article,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteArticle(@Headers('authorization') token: string, @Param('id') id: string) {
    const specialistId = await this.ensureSpecialist(token);
    const result = await this.articleService.deleteArticle(specialistId, id);
    return {
      success: true,
      ...result,
    };
  }

  @Patch(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publishArticle(@Headers('authorization') token: string, @Param('id') id: string) {
    const specialistId = await this.ensureSpecialist(token);
    const article = await this.articleService.publishArticle(specialistId, id);
    return {
      success: true,
      message: 'Article published successfully',
      data: article,
    };
  }
}

