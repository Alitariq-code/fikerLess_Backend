import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Article, ArticleDocument, ArticleStatus, ArticleCategory } from '../models/schemas/article.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticleService {
  constructor(
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SpecialistProfile.name) private specialistModel: Model<SpecialistProfileDocument>,
  ) {}

  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const textContent = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    const wordCount = textContent.trim().split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    return Math.max(1, readTime); // Minimum 1 minute
  }

  private formatArticleResponse(article: ArticleDocument, includeContent: boolean = true) {
    return {
      _id: article._id.toString(),
      title: article.title,
      category: article.category,
      content: includeContent ? article.content : undefined,
      featured_image_url: article.featured_image_url,
      status: article.status,
      published_at: article.published_at,
      views: article.views,
      likes: article.likes,
      read_time_minutes: article.read_time_minutes,
      created_at: (article as any).createdAt,
      updated_at: (article as any).updatedAt,
    };
  }

  private async enrichArticleWithAuthor(article: ArticleDocument, includeContent: boolean = true) {
    const specialist = await this.specialistModel.findOne({ user_id: article.specialist_id });
    const user = await this.userModel.findById(article.specialist_id);

    const articleData = this.formatArticleResponse(article, includeContent);

    return {
      ...articleData,
      author: {
        _id: article.specialist_id.toString(),
        name: specialist?.full_name || user?.email || 'Unknown',
        profile_photo: specialist?.profile_photo,
        designation: specialist?.designation,
      },
    };
  }

  async createArticle(specialistId: string, dto: CreateArticleDto) {
    const user = await this.userModel.findById(specialistId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.user_type !== 'specialist') {
      throw new ForbiddenException('Only specialists can create articles');
    }

    const readTime = this.calculateReadTime(dto.content);
    const status = dto.status || ArticleStatus.DRAFT;

    const article = await this.articleModel.create({
      specialist_id: specialistId,
      title: dto.title,
      category: dto.category,
      content: dto.content,
      featured_image_url: dto.featured_image_url,
      status,
      read_time_minutes: readTime,
      published_at: status === ArticleStatus.PUBLISHED ? new Date() : undefined,
    });

    return this.formatArticleResponse(article);
  }

  async getMyArticles(specialistId: string, status?: string, page: number = 1, limit: number = 10) {
    const user = await this.userModel.findById(specialistId);
    if (!user || user.user_type !== 'specialist') {
      throw new ForbiddenException('Only specialists can access this endpoint');
    }

    const query: any = { specialist_id: specialistId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const [articles, total] = await Promise.all([
      this.articleModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.articleModel.countDocuments(query).exec(),
    ]);

    const publishedCount = await this.articleModel.countDocuments({
      specialist_id: specialistId,
      status: ArticleStatus.PUBLISHED,
    });

    return {
      data: articles.map((article) => this.formatArticleResponse(article, false)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      published_count: publishedCount,
    };
  }

  async getArticles(
    category?: string,
    specialistId?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const query: any = { status: ArticleStatus.PUBLISHED };

    if (category && category !== 'All Articles') {
      query.category = category;
    }

    if (specialistId) {
      query.specialist_id = new Types.ObjectId(specialistId);
    }

    const skip = (page - 1) * limit;
    const [articles, total] = await Promise.all([
      this.articleModel
        .find(query)
        .sort({ published_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.articleModel.countDocuments(query).exec(),
    ]);

    const enrichedArticles = await Promise.all(
      articles.map((article) => this.enrichArticleWithAuthor(article, false)),
    );

    return {
      data: enrichedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFeaturedArticles(limit: number = 6) {
    const articles = await this.articleModel
      .find({ status: ArticleStatus.PUBLISHED })
      .sort({ views: -1, published_at: -1 })
      .limit(limit)
      .exec();

    const enrichedArticles = await Promise.all(
      articles.map((article) => this.enrichArticleWithAuthor(article, false)),
    );

    return enrichedArticles;
  }

  async getArticleById(articleId: string, incrementView: boolean = true) {
    const article = await this.articleModel.findById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.status !== ArticleStatus.PUBLISHED) {
      throw new NotFoundException('Article not found');
    }

    if (incrementView) {
      article.views += 1;
      await article.save();
    }

    return this.enrichArticleWithAuthor(article, true);
  }

  async searchArticles(query: string, page: number = 1, limit: number = 10) {
    if (!query || query.trim().length === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        count: 0,
      };
    }

    const searchQuery = {
      status: ArticleStatus.PUBLISHED,
      $text: { $search: query },
    };

    const skip = (page - 1) * limit;
    const [articles, total] = await Promise.all([
      this.articleModel
        .find(searchQuery)
        .sort({ score: { $meta: 'textScore' }, published_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.articleModel.countDocuments(searchQuery).exec(),
    ]);

    const enrichedArticles = await Promise.all(
      articles.map((article) => this.enrichArticleWithAuthor(article, false)),
    );

    return {
      data: enrichedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      count: total,
    };
  }

  async updateArticle(specialistId: string, articleId: string, dto: UpdateArticleDto) {
    const article = await this.articleModel.findById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.specialist_id.toString() !== specialistId) {
      throw new ForbiddenException('You can only update your own articles');
    }

    if (dto.title) article.title = dto.title;
    if (dto.category) article.category = dto.category;
    if (dto.content) {
      article.content = dto.content;
      article.read_time_minutes = this.calculateReadTime(dto.content);
    }
    if (dto.featured_image_url !== undefined) article.featured_image_url = dto.featured_image_url;
    if (dto.status) {
      article.status = dto.status;
      if (dto.status === ArticleStatus.PUBLISHED && !article.published_at) {
        article.published_at = new Date();
      }
    }

    await article.save();
    return this.formatArticleResponse(article);
  }

  async deleteArticle(specialistId: string, articleId: string) {
    const article = await this.articleModel.findById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.specialist_id.toString() !== specialistId) {
      throw new ForbiddenException('You can only delete your own articles');
    }

    await article.deleteOne();
    return { success: true, message: 'Article deleted successfully' };
  }

  async publishArticle(specialistId: string, articleId: string) {
    const article = await this.articleModel.findById(articleId);
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (article.specialist_id.toString() !== specialistId) {
      throw new ForbiddenException('You can only publish your own articles');
    }

    if (article.status === ArticleStatus.PUBLISHED) {
      throw new BadRequestException('Article is already published');
    }

    article.status = ArticleStatus.PUBLISHED;
    article.published_at = new Date();
    await article.save();

    return this.formatArticleResponse(article);
  }

  getCategories(): string[] {
    return Object.values(ArticleCategory);
  }
}

