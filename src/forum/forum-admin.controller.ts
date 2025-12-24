import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { getUserFromToken } from '../utils/utils';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Model } from 'mongoose';

@Controller('api/v1/forum/admin')
export class ForumAdminController {
  constructor(
    private readonly forumService: ForumService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async ensureAdmin(token: string): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Please log in to access this feature');
    }
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      throw new UnauthorizedException(result.error || 'Your session is invalid. Please log in again.');
    }
    if (result.user.user_type !== 'admin') {
      throw new ForbiddenException('Only admins can access this endpoint');
    }
    return result.user._id.toString();
  }

  /**
   * Get all posts (like Facebook news feed) - Admin only
   * GET /api/v1/forum/admin/posts
   */
  @Get('posts')
  @HttpCode(HttpStatus.OK)
  async getAllPosts(
    @Headers('authorization') token: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const result = await this.forumService.getAllPostsForAdmin(category, search, pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get single post with all details - Admin only
   * GET /api/v1/forum/admin/posts/:id
   */
  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
  async getPostById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const post = await this.forumService.getPostByIdForAdmin(id);
    return {
      success: true,
      data: post,
    };
  }

  /**
   * Update any post - Admin only
   * PUT /api/v1/forum/admin/posts/:id
   */
  @Put('posts/:id')
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateForumPostDto,
  ) {
    await this.ensureAdmin(token);
    const post = await this.forumService.updatePostAsAdmin(id, dto);
    return {
      success: true,
      message: 'Post updated successfully',
      data: post,
    };
  }

  /**
   * Delete any post - Admin only
   * DELETE /api/v1/forum/admin/posts/:id
   */
  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.forumService.deletePostAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get all comments for a post - Admin only
   * GET /api/v1/forum/admin/posts/:postId/comments
   */
  @Get('posts/:postId/comments')
  @HttpCode(HttpStatus.OK)
  async getComments(
    @Headers('authorization') token: string,
    @Param('postId') postId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.ensureAdmin(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const result = await this.forumService.getCommentsForAdmin(postId, pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get single comment - Admin only
   * GET /api/v1/forum/admin/comments/:id
   */
  @Get('comments/:id')
  @HttpCode(HttpStatus.OK)
  async getCommentById(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const comment = await this.forumService.getCommentByIdForAdmin(id);
    return {
      success: true,
      data: comment,
    };
  }

  /**
   * Update any comment - Admin only
   * PUT /api/v1/forum/admin/comments/:id
   */
  @Put('comments/:id')
  @HttpCode(HttpStatus.OK)
  async updateComment(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    await this.ensureAdmin(token);
    const comment = await this.forumService.updateCommentAsAdmin(id, dto);
    return {
      success: true,
      message: 'Comment updated successfully',
      data: comment,
    };
  }

  /**
   * Delete any comment - Admin only
   * DELETE /api/v1/forum/admin/comments/:id
   */
  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(token);
    const result = await this.forumService.deleteCommentAsAdmin(id);
    return {
      success: true,
      ...result,
    };
  }

  /**
   * Get forum statistics - Admin only
   * GET /api/v1/forum/admin/stats
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(
    @Headers('authorization') token: string,
  ) {
    await this.ensureAdmin(token);
    const stats = await this.forumService.getForumStatsForAdmin();
    return {
      success: true,
      data: stats,
    };
  }
}

