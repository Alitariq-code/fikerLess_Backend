import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ForumPost, ForumPostDocument } from '../models/schemas/forum-post.schema';
import { ForumLike, ForumLikeDocument } from '../models/schemas/forum-like.schema';
import { ForumComment, ForumCommentDocument } from '../models/schemas/forum-comment.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';
import { ArticleCategory } from '../models/schemas/article.schema';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ForumService {
  constructor(
    @InjectModel(ForumPost.name) private forumPostModel: Model<ForumPostDocument>,
    @InjectModel(ForumLike.name) private forumLikeModel: Model<ForumLikeDocument>,
    @InjectModel(ForumComment.name) private forumCommentModel: Model<ForumCommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async createPost(userId: string, dto: CreateForumPostDto): Promise<any> {
    const post = new this.forumPostModel({
      user_id: userId,
      ...dto,
      is_anonymous: dto.is_anonymous || false,
    });
    await post.save();
    return this.formatPostResponse(post);
  }

  async getPosts(category?: string, page: number = 1, limit: number = 10): Promise<any> {
    // Validate and sanitize pagination params
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit)); // Max 100, min 1
    const skip = (pageNum - 1) * limitNum;
    const filter: any = {};
    
    if (category) {
      filter.category = category;
    }

    const [posts, total] = await Promise.all([
      this.forumPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email')
        .exec(),
      this.forumPostModel.countDocuments(filter).exec(),
    ]);

    return {
      data: posts.map(post => this.formatPostResponse(post)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getPostById(postId: string, userId?: string): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel
      .findById(postId)
      .populate('user_id', 'first_name last_name email')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Increment views
    post.views += 1;
    await post.save();

    // Check if user liked this post
    let is_liked = false;
    if (userId) {
      const like = await this.forumLikeModel.findOne({ post_id: postId, user_id: userId }).exec();
      is_liked = !!like;
    }

    const response = this.formatPostResponse(post);
    if (userId) {
      response.is_liked = is_liked;
    }

    return response;
  }

  async searchPosts(query: string, page: number = 1, limit: number = 10): Promise<any> {
    // Validate and sanitize pagination params
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit)); // Max 100, min 1
    const skip = (pageNum - 1) * limitNum;
    
    // Use regex search for title and description
    let filter: any = {};
    if (query && query.trim()) {
      filter = {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
        ],
      };
    }

    const [posts, total] = await Promise.all([
      this.forumPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email')
        .exec(),
      this.forumPostModel.countDocuments(filter).exec(),
    ]);

    return {
      data: posts.map(post => this.formatPostResponse(post)),
      count: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getCategories(): Promise<any> {
    const categories = Object.values(ArticleCategory);
    const categoryCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await this.forumPostModel.countDocuments({ category }).exec();
        return { category, count };
      })
    );

    return categoryCounts;
  }

  async toggleLike(userId: string, postId: string): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.forumLikeModel.findOne({ post_id: postId, user_id: userId }).exec();

    if (existingLike) {
      // Unlike - remove the like
      await existingLike.deleteOne();
      post.likes_count = Math.max(0, post.likes_count - 1);
      await post.save();
      return { is_liked: false, likes_count: post.likes_count };
    } else {
      // Like - create new like
      const like = new this.forumLikeModel({ post_id: postId, user_id: userId });
      await like.save();
      post.likes_count += 1;
      await post.save();

      // Send notification to post author (if not liking own post)
      if (post.user_id.toString() !== userId) {
        try {
          // Fetch the user who liked the post
          const likerUser = await this.userModel.findById(userId).exec();
          const likerName = likerUser 
            ? `${likerUser.first_name} ${likerUser.last_name}`.trim() || likerUser.email.split('@')[0] || `User_${userId.slice(-6)}`
            : `User_${userId.slice(-6)}`;
          
          const postTitle = post.title.length > 50 ? post.title.substring(0, 50) + '...' : post.title;
          await this.notificationService.createDirectNotification(
            post.user_id.toString(),
            `${likerName} liked your post`,
            `${likerName} liked your post "${postTitle}"`,
            'forum_like',
            { post_id: postId, liker_id: userId, liker_name: likerName },
            `/forum/posts/${postId}`,
          );
        } catch (error) {
          // Don't fail the like operation if notification fails
          console.error('Failed to send like notification:', error);
        }
      }

      return { is_liked: true, likes_count: post.likes_count };
    }
  }

  async getComments(postId: string, page: number = 1, limit: number = 20): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    // Validate and sanitize pagination params
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit)); // Max 100, min 1
    const skip = (pageNum - 1) * limitNum;

    // Verify post exists
    const post = await this.forumPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [comments, total] = await Promise.all([
      this.forumCommentModel
        .find({ post_id: postId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email')
        .exec(),
      this.forumCommentModel.countDocuments({ post_id: postId }).exec(),
    ]);

    return {
      data: comments.map(comment => this.formatCommentResponse(comment)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  async createComment(userId: string, postId: string, dto: CreateCommentDto): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = new this.forumCommentModel({
      post_id: postId,
      user_id: userId,
      ...dto,
      is_anonymous: dto.is_anonymous || false,
    });
    await comment.save();

    // Update comment count on post
    post.comments_count += 1;
    await post.save();

    // Send notification to post author (if not commenting on own post)
    if (post.user_id.toString() !== userId) {
      try {
        // Fetch the user who commented
        const commenterUser = await this.userModel.findById(userId).exec();
        const commenterName = commenterUser 
          ? `${commenterUser.first_name} ${commenterUser.last_name}`.trim() || commenterUser.email.split('@')[0] || `User_${userId.slice(-6)}`
          : `User_${userId.slice(-6)}`;
        
        const postTitle = post.title.length > 50 ? post.title.substring(0, 50) + '...' : post.title;
        const commentPreview = comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content;
        
        await this.notificationService.createDirectNotification(
          post.user_id.toString(),
          `${commenterName} commented on your post`,
          `${commenterName}: "${commentPreview}"`,
          'forum_comment',
          { post_id: postId, comment_id: comment._id.toString(), commenter_id: userId, commenter_name: commenterName },
          `/forum/posts/${postId}`,
        );
      } catch (error) {
        // Don't fail the comment operation if notification fails
        console.error('Failed to send comment notification:', error);
      }
    }

    return this.formatCommentResponse(comment);
  }

  async updateComment(userId: string, commentId: string, dto: UpdateCommentDto): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel.findById(commentId).exec();
    
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    if (dto.content) {
      comment.content = dto.content;
    }
    await comment.save();
    
    return this.formatCommentResponse(comment);
  }

  async deleteComment(userId: string, commentId: string): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel.findById(commentId).exec();
    
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Update comment count on post
    const post = await this.forumPostModel.findById(comment.post_id).exec();
    if (post) {
      post.comments_count = Math.max(0, post.comments_count - 1);
      await post.save();
    }

    await comment.deleteOne();
    return { message: 'Comment deleted successfully' };
  }

  private formatPostResponse(post: ForumPostDocument): any {
    const user = (post as any).user_id;
    const authorName = post.is_anonymous 
      ? `Anonymous_user_${post.user_id.toString().slice(-3)}`
      : user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown';

    return {
      _id: post._id,
      title: post.title,
      description: post.description,
      category: post.category,
      is_anonymous: post.is_anonymous,
      author: authorName,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      views: post.views,
      created_at: (post as any).createdAt,
      updated_at: (post as any).updatedAt,
    };
  }

  private formatCommentResponse(comment: ForumCommentDocument): any {
    const user = (comment as any).user_id;
    const authorName = comment.is_anonymous
      ? `Anonymous_user_${comment.user_id.toString().slice(-3)}`
      : user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown';

    return {
      _id: comment._id,
      post_id: comment.post_id,
      content: comment.content,
      is_anonymous: comment.is_anonymous,
      author: authorName,
      created_at: (comment as any).createdAt,
      updated_at: (comment as any).updatedAt,
    };
  }

  // Step 3: Update Post
  async updatePost(userId: string, postId: string, dto: UpdateForumPostDto): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if user owns the post
    if (post.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    // Update fields
    if (dto.title !== undefined) {
      post.title = dto.title;
    }
    if (dto.description !== undefined) {
      post.description = dto.description;
    }
    if (dto.category !== undefined) {
      post.category = dto.category;
    }
    if (dto.is_anonymous !== undefined) {
      post.is_anonymous = dto.is_anonymous;
    }

    await post.save();
    return this.formatPostResponse(post);
  }

  // Step 3: Delete Post
  async deletePost(userId: string, postId: string): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if user owns the post
    if (post.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Delete all associated likes
    await this.forumLikeModel.deleteMany({ post_id: postId }).exec();

    // Delete all associated comments
    await this.forumCommentModel.deleteMany({ post_id: postId }).exec();

    // Delete the post
    await post.deleteOne();

    return { message: 'Post deleted successfully' };
  }

  // Step 3: Get My Posts
  async getMyPosts(userId: string, category?: string, page: number = 1, limit: number = 10): Promise<any> {
    // Validate and sanitize pagination params
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit)); // Max 100, min 1
    const skip = (pageNum - 1) * limitNum;
    
    const filter: any = { user_id: userId };
    
    if (category) {
      filter.category = category;
    }

    const [posts, total] = await Promise.all([
      this.forumPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email')
        .exec(),
      this.forumPostModel.countDocuments(filter).exec(),
    ]);

    return {
      data: posts.map(post => this.formatPostResponse(post)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }
}

