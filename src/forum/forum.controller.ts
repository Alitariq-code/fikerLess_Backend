import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';
import { getUserFromToken } from '../utils/utils';
import { User, UserDocument } from '../models/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Controller('api/v1/forum')
export class ForumController {
  constructor(
    private readonly forumService: ForumService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async getUserIdFromToken(token?: string): Promise<string | undefined> {
    if (!token) return undefined;
    
    const result = await getUserFromToken(token, this.userModel);
    if (!result.success || !result.user) {
      return undefined;
    }
    return result.user._id.toString();
  }

  @Post('posts')
  @HttpCode(HttpStatus.CREATED)
  async createPost(@Headers('authorization') token: string, @Body() dto: CreateForumPostDto) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to create a post');
    }
    
    const post = await this.forumService.createPost(userId, dto);
    return {
      success: true,
      message: 'Post created successfully',
      data: post,
    };
  }

  @Get('posts')
  @HttpCode(HttpStatus.OK)
  async getPosts(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') token?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.forumService.getPosts(category, pageNum, limitNum, userId);
    return {
      success: true,
      ...result,
    };
  }

  @Get('posts/search')
  @HttpCode(HttpStatus.OK)
  async searchPosts(
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') token?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.forumService.searchPosts(query || '', pageNum, limitNum, userId);
    return {
      success: true,
      ...result,
    };
  }

  // Step 3: Get My Posts - Must be before posts/:id to avoid route conflict
  @Get('posts/my-posts')
  @HttpCode(HttpStatus.OK)
  async getMyPosts(
    @Headers('authorization') token: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to view your posts');
    }
    
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const result = await this.forumService.getMyPosts(userId, category, pageNum, limitNum);
    return {
      success: true,
      ...result,
    };
  }

  @Get('posts/:id')
  @HttpCode(HttpStatus.OK)
  async getPostById(
    @Param('id') id: string,
    @Headers('authorization') token?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const post = await this.forumService.getPostById(id, userId);
    return {
      success: true,
      data: post,
    };
  }

  @Get('categories')
  @HttpCode(HttpStatus.OK)
  async getCategories() {
    const categories = await this.forumService.getCategories();
    return {
      success: true,
      data: categories,
    };
  }

  @Post('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  async toggleLike(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to like a post');
    }
    
    const result = await this.forumService.toggleLike(userId, id);
    return {
      success: true,
      ...result,
    };
  }

  @Get('posts/:id/comments')
  @HttpCode(HttpStatus.OK)
  async getComments(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') token?: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const result = await this.forumService.getComments(id, pageNum, limitNum, userId);
    return {
      success: true,
      ...result,
    };
  }

  @Post('posts/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to add a comment');
    }
    
    const comment = await this.forumService.createComment(userId, id, dto);
    return {
      success: true,
      message: 'Comment added successfully',
      data: comment,
    };
  }

  @Put('posts/:postId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  async updateComment(
    @Headers('authorization') token: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to update a comment');
    }
    
    const comment = await this.forumService.updateComment(userId, commentId, dto);
    return {
      success: true,
      message: 'Comment updated successfully',
      data: comment,
    };
  }

  @Delete('posts/:postId/comments/:commentId')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Headers('authorization') token: string,
    @Param('commentId') commentId: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to delete a comment');
    }
    
    const result = await this.forumService.deleteComment(userId, commentId);
    return {
      success: true,
      ...result,
    };
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  async toggleCommentLike(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to like a comment');
    }
    
    const result = await this.forumService.toggleCommentLike(userId, id);
    return {
      success: true,
      ...result,
    };
  }

  // Step 3: Update Post
  @Put('posts/:id')
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Headers('authorization') token: string,
    @Param('id') id: string,
    @Body() dto: UpdateForumPostDto,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to update a post');
    }
    
    const post = await this.forumService.updatePost(userId, id, dto);
    return {
      success: true,
      message: 'Post updated successfully',
      data: post,
    };
  }

  // Step 3: Delete Post
  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Headers('authorization') token: string,
    @Param('id') id: string,
  ) {
    const userId = await this.getUserIdFromToken(token);
    if (!userId) {
      throw new UnauthorizedException('Please log in to delete a post');
    }
    
    const result = await this.forumService.deletePost(userId, id);
    return {
      success: true,
      ...result,
    };
  }

}

