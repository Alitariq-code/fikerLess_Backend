import { Injectable, NotFoundException, ForbiddenException, Logger, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ForumPost, ForumPostDocument } from '../models/schemas/forum-post.schema';
import { ForumLike, ForumLikeDocument } from '../models/schemas/forum-like.schema';
import { ForumComment, ForumCommentDocument } from '../models/schemas/forum-comment.schema';
import { ForumCommentLike, ForumCommentLikeDocument } from '../models/schemas/forum-comment-like.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { CreateForumPostDto } from './dto/create-forum-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdateForumPostDto } from './dto/update-forum-post.dto';
import { ArticleCategory } from '../models/schemas/article.schema';
import { NotificationService } from '../notification/notification.service';
import { AchievementService } from '../achievement/achievement.service';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    @InjectModel(ForumPost.name) private forumPostModel: Model<ForumPostDocument>,
    @InjectModel(ForumLike.name) private forumLikeModel: Model<ForumLikeDocument>,
    @InjectModel(ForumComment.name) private forumCommentModel: Model<ForumCommentDocument>,
    @InjectModel(ForumCommentLike.name) private forumCommentLikeModel: Model<ForumCommentLikeDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AchievementService))
    private readonly achievementService: AchievementService,
  ) {}

  async createPost(userId: string, dto: CreateForumPostDto): Promise<any> {
    const post = new this.forumPostModel({
      user_id: userId,
      title: dto.title,
      description: dto.description,
      category: dto.category || undefined,
      is_anonymous: dto.is_anonymous || false,
    });
    await post.save();
    return this.formatPostResponse(post, userId);
  }

  async getPosts(category?: string, page: number = 1, limit: number = 10, userId?: string): Promise<any> {
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

    // If userId is provided, check which posts are liked by this user
    let likedPostIds: Set<string> = new Set();
    if (userId) {
      const postIds = posts.map(post => post._id.toString());
      const likes = await this.forumLikeModel.find({
        post_id: { $in: postIds },
        user_id: userId,
      }).exec();
      likedPostIds = new Set(likes.map(like => like.post_id.toString()));
    }

    return {
      data: posts.map(post => {
        const formatted = this.formatPostResponse(post, userId);
        if (userId) {
          formatted.is_liked = likedPostIds.has(post._id.toString());
        }
        return formatted;
      }),
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

    const response = this.formatPostResponse(post, userId);
    if (userId) {
      response.is_liked = is_liked;
    }

    return response;
  }

  async searchPosts(query: string, page: number = 1, limit: number = 10, userId?: string): Promise<any> {
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

    // If userId is provided, check which posts are liked by this user
    let likedPostIds: Set<string> = new Set();
    if (userId) {
      const postIds = posts.map(post => post._id.toString());
      const likes = await this.forumLikeModel.find({
        post_id: { $in: postIds },
        user_id: userId,
      }).exec();
      likedPostIds = new Set(likes.map(like => like.post_id.toString()));
    }

    return {
      data: posts.map(post => {
        const formatted = this.formatPostResponse(post, userId);
        if (userId) {
          formatted.is_liked = likedPostIds.has(post._id.toString());
        }
        return formatted;
      }),
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
          
          // In-app notification - always attempt to create
          const inAppNotifCreated = await this.notificationService.createDirectNotification(
            post.user_id.toString(),
            `${likerName} liked your post`,
            `${likerName} liked your post "${postTitle}"`,
            'forum_like',
            { post_id: postId, liker_id: userId, liker_name: likerName },
            `/forum/posts/${postId}`,
          );

          if (inAppNotifCreated) {
            this.logger.debug(`In-app notification created/updated for post ${postId} to user ${post.user_id} (liked by ${userId})`);
          } else {
            this.logger.warn(`Failed to create in-app notification for post ${postId} to user ${post.user_id} (liked by ${userId})`);
          }

          // Facebook-style FCM push notification
          this.notificationService.sendFcmPushNotification(
            post.user_id.toString(),
            `${likerName} liked your post`,
            postTitle,
            'forum_like',
            {
              post_id: postId,
              liker_id: userId,
              liker_name: likerName,
            },
            false, // Forum notifications don't check appointment_reminders
          ).catch((fcmError) => {
            this.logger.warn(`FCM push notification failed for user ${post.user_id} (post like): ${fcmError.message || fcmError}`);
          });
        } catch (error: any) {
          // Don't fail the like operation if notification fails
          this.logger.error(
            `Failed to send like notification for post ${postId} to user ${post.user_id}: ${error.message || error}`,
            error.stack || error,
          );
        }
      }

      return { is_liked: true, likes_count: post.likes_count };
    }
  }

  async getComments(postId: string, page: number = 1, limit: number = 20, userId?: string): Promise<any> {
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

    // Get top-level comments only (no parent_comment_id)
    const [topLevelComments, total] = await Promise.all([
      this.forumCommentModel
        .find({ post_id: postId, parent_comment_id: { $exists: false } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email')
        .exec(),
      this.forumCommentModel.countDocuments({ post_id: postId, parent_comment_id: { $exists: false } }).exec(),
    ]);

    // Get all comment IDs to check likes
    const allCommentIds = topLevelComments.map(c => c._id.toString());
    
    // Get user's liked comments if userId provided
    let likedCommentIds: Set<string> = new Set();
    if (userId) {
      const likes = await this.forumCommentLikeModel.find({
        comment_id: { $in: allCommentIds },
        user_id: userId,
      }).exec();
      likedCommentIds = new Set(likes.map(like => like.comment_id.toString()));
    }

    // Build nested structure with replies
    const nestedComments = await Promise.all(
      topLevelComments.map(async (comment) => {
        const formatted = await this.formatCommentResponse(comment, userId, likedCommentIds);
        
        // Get replies for this comment
        const replies = await this.forumCommentModel
          .find({ parent_comment_id: comment._id })
          .sort({ createdAt: 1 }) // Oldest first for replies
          .populate('user_id', 'first_name last_name email')
          .exec();

        // Get liked reply IDs
        const replyIds = replies.map(r => r._id.toString());
        let likedReplyIds: Set<string> = new Set();
        if (userId && replyIds.length > 0) {
          const replyLikes = await this.forumCommentLikeModel.find({
            comment_id: { $in: replyIds },
            user_id: userId,
          }).exec();
          likedReplyIds = new Set(replyLikes.map(like => like.comment_id.toString()));
        }

        formatted.replies = await Promise.all(
          replies.map(reply => this.formatCommentResponse(reply, userId, likedReplyIds))
        );

        return formatted;
      })
    );

    return {
      data: nestedComments,
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

    // If parent_comment_id is provided, validate it's a reply to a comment
    let parentComment: ForumCommentDocument | null = null;
    if (dto.parent_comment_id) {
      if (!/^[0-9a-fA-F]{24}$/.test(dto.parent_comment_id)) {
        throw new BadRequestException('Invalid parent comment ID format');
      }

      parentComment = await this.forumCommentModel.findById(dto.parent_comment_id).exec();
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.post_id.toString() !== postId) {
        throw new BadRequestException('Parent comment does not belong to this post');
      }

      // Prevent nested replies beyond one level (replies to replies)
      if (parentComment.parent_comment_id) {
        throw new BadRequestException('Cannot reply to a reply. Please reply to the original comment.');
      }
    }

    const comment = new this.forumCommentModel({
      post_id: postId,
      user_id: userId,
      content: dto.content,
      is_anonymous: dto.is_anonymous || false,
      parent_comment_id: dto.parent_comment_id ? new Types.ObjectId(dto.parent_comment_id) : undefined,
      likes_count: 0,
    });
    await comment.save();

    // Update comment count on post (only for top-level comments)
    if (!dto.parent_comment_id) {
      post.comments_count += 1;
      await post.save();
    }

    // Determine notification recipient
    let notificationRecipientId: string | null = null;
    let notificationType = 'forum_comment';
    let notificationTitle = '';
    let notificationBody = '';

    if (dto.parent_comment_id && parentComment) {
      // Reply to comment - notify comment author
      notificationRecipientId = parentComment.user_id.toString();
      notificationType = 'forum_comment_reply';
      
      const commenterUser = await this.userModel.findById(userId).exec();
      const commenterName = commenterUser 
        ? `${commenterUser.first_name} ${commenterUser.last_name}`.trim() || commenterUser.email.split('@')[0] || `User_${userId.slice(-6)}`
        : `User_${userId.slice(-6)}`;
      
      const commentPreview = comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content;
      notificationTitle = `${commenterName} replied to your comment`;
      notificationBody = `${commenterName}: "${commentPreview}"`;
    } else if (post.user_id.toString() !== userId) {
      // Top-level comment - notify post author
      notificationRecipientId = post.user_id.toString();
      notificationType = 'forum_comment';
      
      const commenterUser = await this.userModel.findById(userId).exec();
      const commenterName = commenterUser 
        ? `${commenterUser.first_name} ${commenterUser.last_name}`.trim() || commenterUser.email.split('@')[0] || `User_${userId.slice(-6)}`
        : `User_${userId.slice(-6)}`;
      
      const commentPreview = comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content;
      notificationTitle = `${commenterName} commented on your post`;
      notificationBody = `${commenterName}: "${commentPreview}"`;
    }

    // Send notification if recipient exists and is not the commenter
    if (notificationRecipientId && notificationRecipientId !== userId) {
      try {
        // In-app notification - always attempt to create
        const inAppNotifCreated = await this.notificationService.createDirectNotification(
          notificationRecipientId,
          notificationTitle,
          notificationBody,
          notificationType,
          { 
            post_id: postId, 
            comment_id: comment._id.toString(),
            parent_comment_id: dto.parent_comment_id || null,
            commenter_id: userId,
          },
          `/forum/posts/${postId}`,
        );

        if (inAppNotifCreated) {
          this.logger.debug(`In-app notification created/updated for post ${postId} to user ${notificationRecipientId} (commented by ${userId})`);
        } else {
          this.logger.error(`Failed to create in-app notification for post ${postId} to user ${notificationRecipientId} (commented by ${userId}) - check logs above for details`);
        }

        // Facebook-style FCM push notification
        // For comments, show a cleaner message
        const fcmTitle = dto.parent_comment_id 
          ? notificationTitle // "John replied to your comment"
          : notificationTitle; // "John commented on your post"
        
        const fcmBody = comment.content.length > 80 
          ? comment.content.substring(0, 80) + '...' 
          : comment.content;

        this.notificationService.sendFcmPushNotification(
          notificationRecipientId,
          fcmTitle,
          fcmBody,
          notificationType,
          { 
            post_id: postId, 
            comment_id: comment._id.toString(),
            parent_comment_id: dto.parent_comment_id || null,
            commenter_id: userId,
          },
          false, // Forum notifications don't check appointment_reminders
        ).catch((fcmError) => {
          this.logger.warn(`FCM push notification failed for user ${notificationRecipientId} (forum comment): ${fcmError.message || fcmError}`);
        });
      } catch (error: any) {
        // Don't fail the comment operation if notification fails
        this.logger.error(
          `Failed to send comment notification: ${error.message || error}`,
          error.stack || error,
        );
      }
    }

    // Check forum achievements (user is helping someone else) - only for top-level comments
    if (!dto.parent_comment_id && post.user_id.toString() !== userId) {
      this.checkAchievementsAsync(userId);
    }

    return await this.formatCommentResponse(comment, userId);
  }

  private async checkAchievementsAsync(userId: string): Promise<void> {
    try {
      await this.achievementService.checkForumAchievements(userId);
    } catch (error) {
      // Don't fail the main operation if achievement check fails
      this.logger.error(`Error checking forum achievements for user ${userId}:`, error);
    }
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
    
    return await this.formatCommentResponse(comment);
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

    // Update comment count on post (only for top-level comments)
    if (!comment.parent_comment_id) {
      const post = await this.forumPostModel.findById(comment.post_id).exec();
      if (post) {
        post.comments_count = Math.max(0, post.comments_count - 1);
        await post.save();
      }
    }

    // Delete all replies to this comment first
    await this.forumCommentModel.deleteMany({ parent_comment_id: comment._id }).exec();

    // Delete all likes for this comment and its replies
    const replyIds = await this.forumCommentModel.find({ parent_comment_id: comment._id }).distinct('_id').exec();
    const allCommentIds = [comment._id, ...replyIds];
    await this.forumCommentLikeModel.deleteMany({ comment_id: { $in: allCommentIds } }).exec();

    await comment.deleteOne();
    return { message: 'Comment deleted successfully' };
  }

  async toggleCommentLike(userId: string, commentId: string): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existingLike = await this.forumCommentLikeModel.findOne({
      comment_id: commentId,
      user_id: userId,
    }).exec();

    if (existingLike) {
      // Unlike: remove like and decrement count
      await existingLike.deleteOne();
      comment.likes_count = Math.max(0, (comment.likes_count || 0) - 1);
      await comment.save();
      return {
        message: 'Comment unliked successfully',
        is_liked: false,
        likes_count: comment.likes_count,
      };
    } else {
      // Like: add like and increment count
      const newLike = new this.forumCommentLikeModel({
        comment_id: commentId,
        user_id: userId,
      });
      await newLike.save();
      comment.likes_count = (comment.likes_count || 0) + 1;
      await comment.save();
      return {
        message: 'Comment liked successfully',
        is_liked: true,
        likes_count: comment.likes_count,
      };
    }
  }

  private formatPostResponse(post: ForumPostDocument, userId?: string): any {
    const user = (post as any).user_id;
    const authorName = post.is_anonymous 
      ? `Anonymous_user_${(post.user_id?.toString() || post._id?.toString() || '000').slice(-3)}`
      : user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown';

    // Check if this post belongs to the current user
    // Handle both populated (object) and unpopulated (ObjectId) user_id
    let postUserId: string;
    if (user && typeof user === 'object' && user._id) {
      // user_id is populated (object with _id)
      postUserId = user._id.toString();
    } else if (post.user_id) {
      // user_id is ObjectId
      postUserId = (post.user_id as any).toString();
    } else {
      // user_id is null or undefined - handle gracefully
      postUserId = '';
    }
    const is_user_post = userId ? postUserId === userId : false;

    return {
      _id: post._id,
      title: post.title,
      description: post.description,
      category: post.category,
      is_anonymous: post.is_anonymous,
      admin_post: (post as any).admin_post || false,
      author: authorName,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      views: post.views,
      created_at: (post as any).createdAt,
      updated_at: (post as any).updatedAt,
      is_user_post: is_user_post,
    };
  }

  private async formatCommentResponse(
    comment: ForumCommentDocument | any,
    userId?: string,
    likedCommentIds?: Set<string>
  ): Promise<any> {
    const user = (comment as any).user_id;
    const authorName = comment.is_anonymous
      ? `Anonymous_user_${(comment.user_id?.toString() || comment._id?.toString() || '000').slice(-3)}`
      : user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown';

    // Check if user liked this comment
    let is_liked = false;
    if (userId) {
      if (likedCommentIds) {
        is_liked = likedCommentIds.has(comment._id.toString());
      } else {
        const like = await this.forumCommentLikeModel.findOne({
          comment_id: comment._id,
          user_id: userId,
        }).exec();
        is_liked = !!like;
      }
    }

    // Handle parent_comment_id - it might be an ObjectId, a populated object, or already a string
    let parentCommentId: string | null = null;
    if (comment.parent_comment_id) {
      if (typeof comment.parent_comment_id === 'string') {
        parentCommentId = comment.parent_comment_id;
      } else if (comment.parent_comment_id._id) {
        // It's a populated object
        parentCommentId = comment.parent_comment_id._id.toString();
      } else if (comment.parent_comment_id.toString) {
        // It's an ObjectId
        parentCommentId = comment.parent_comment_id.toString();
      }
    }

    return {
      _id: comment._id?.toString() || comment._id,
      post_id: comment.post_id?.toString() || comment.post_id,
      parent_comment_id: parentCommentId,
      content: comment.content,
      is_anonymous: comment.is_anonymous,
      admin_comment: (comment as any).admin_comment || false,
      author: authorName,
      likes_count: comment.likes_count || 0,
      is_liked: is_liked,
      created_at: (comment as any).createdAt || comment.created_at,
      updated_at: (comment as any).updatedAt || comment.updated_at,
      replies: [], // Will be populated by getComments or frontend
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
    return this.formatPostResponse(post, userId);
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

    // Check which posts are liked by this user
    const postIds = posts.map(post => post._id.toString());
    const likes = await this.forumLikeModel.find({
      post_id: { $in: postIds },
      user_id: userId,
    }).exec();
    const likedPostIds = new Set(likes.map(like => like.post_id.toString()));

    return {
      data: posts.map(post => {
        const formatted = this.formatPostResponse(post, userId);
        formatted.is_liked = likedPostIds.has(post._id.toString());
        return formatted;
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  // ==================== Admin Methods ====================

  /**
   * Get all posts for admin (like Facebook news feed)
   */
  async getAllPostsForAdmin(
    adminId: string,
    category?: string,
    search?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<any> {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;
    
    const filter: any = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.forumPostModel
        .find(filter)
        .sort({ createdAt: -1 })
        .populate('user_id', 'first_name last_name email username')
        .skip(skip)
        .limit(limitNum)
        .exec(),
      this.forumPostModel.countDocuments(filter).exec(),
    ]);

    // Check which posts are liked by admin
    const postIds = posts.map(p => p._id.toString());
    const likes = await this.forumLikeModel.find({
      post_id: { $in: postIds },
      user_id: adminId,
    }).exec();
    const likedPostIds = new Set(likes.map(like => like.post_id.toString()));

    return {
      data: posts.map(post => {
        const user = (post as any).user_id;
        const formatted = this.formatPostResponse(post, adminId);
        // Add full user info for admin
        formatted.user = user ? {
          _id: user._id.toString(),
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          username: user.username,
        } : null;
        // Add is_liked status for admin
        formatted.is_liked = likedPostIds.has(post._id.toString());
        return formatted;
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get post by ID for admin (with full details)
   */
  async getPostByIdForAdmin(adminId: string, postId: string): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel
      .findById(postId)
      .populate('user_id', 'first_name last_name email username')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if admin liked this post
    const like = await this.forumLikeModel.findOne({ post_id: postId, user_id: adminId }).exec();
    const is_liked = !!like;

    const user = (post as any).user_id;
    const formatted = this.formatPostResponse(post, adminId);
    formatted.user = user ? {
      _id: user._id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
    } : null;
    formatted.is_liked = is_liked;

    return formatted;
  }

  /**
   * Update any post as admin (no ownership check)
   */
  async updatePostAsAdmin(adminId: string, postId: string, dto: UpdateForumPostDto): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Admin can update any field
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
    return this.formatPostResponse(post, adminId);
  }

  /**
   * Delete any post as admin (no ownership check)
   */
  async deletePostAsAdmin(postId: string): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Delete all associated likes
    await this.forumLikeModel.deleteMany({ post_id: postId }).exec();

    // Delete all associated comments and their likes
    const comments = await this.forumCommentModel.find({ post_id: postId }).exec();
    const commentIds = comments.map(c => c._id);
    
    if (commentIds.length > 0) {
      await this.forumCommentLikeModel.deleteMany({ comment_id: { $in: commentIds } }).exec();
    }
    
    await this.forumCommentModel.deleteMany({ post_id: postId }).exec();

    // Delete the post
    await post.deleteOne();

    return { message: 'Post deleted successfully' };
  }

  /**
   * Get all comments for a post (admin view)
   */
  async getCommentsForAdmin(postId: string, page: number = 1, limit: number = 50): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    // Get all comments (including nested)
    const [comments, total] = await Promise.all([
      this.forumCommentModel
        .find({ post_id: postId })
        .sort({ createdAt: 1 }) // Sort by oldest first to maintain conversation order
        .skip(skip)
        .limit(limitNum)
        .populate('user_id', 'first_name last_name email username')
        // Don't populate parent_comment_id - we only need the ID string, not the full object
        .exec(),
      this.forumCommentModel.countDocuments({ post_id: postId }).exec(),
    ]);

    return {
      data: await Promise.all(
        comments.map(async (comment) => {
          const user = (comment as any).user_id;
          const formatted = await this.formatCommentResponse(comment);
          formatted.user = user ? {
            _id: user._id.toString(),
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            username: user.username,
          } : null;
          return formatted;
        })
      ),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get comment by ID for admin
   */
  async getCommentByIdForAdmin(commentId: string): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel
      .findById(commentId)
      .populate('user_id', 'first_name last_name email username')
      .populate('post_id', 'title')
      .populate('parent_comment_id')
      .exec();

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const user = (comment as any).user_id;
    const formatted = await this.formatCommentResponse(comment);
    formatted.user = user ? {
      _id: user._id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      username: user.username,
    } : null;

    return formatted;
  }

  /**
   * Update any comment as admin (no ownership check)
   */
  async updateCommentAsAdmin(commentId: string, dto: UpdateCommentDto): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel.findById(commentId).exec();
    
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (dto.content) {
      comment.content = dto.content;
    }
    await comment.save();
    
    return await this.formatCommentResponse(comment);
  }

  /**
   * Delete any comment as admin (no ownership check)
   */
  async deleteCommentAsAdmin(commentId: string): Promise<any> {
    if (!/^[0-9a-fA-F]{24}$/.test(commentId)) {
      throw new NotFoundException('Invalid comment ID format');
    }

    const comment = await this.forumCommentModel.findById(commentId).exec();
    
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Update comment count on post (only for top-level comments)
    if (!comment.parent_comment_id) {
      const post = await this.forumPostModel.findById(comment.post_id).exec();
      if (post) {
        post.comments_count = Math.max(0, post.comments_count - 1);
        await post.save();
      }
    }

    // Delete all replies to this comment first
    const replies = await this.forumCommentModel.find({ parent_comment_id: comment._id }).exec();
    const replyIds = replies.map(r => r._id);
    
    // Delete all likes for this comment and its replies
    const allCommentIds = [comment._id, ...replyIds];
    await this.forumCommentLikeModel.deleteMany({ comment_id: { $in: allCommentIds } }).exec();

    // Delete all replies
    await this.forumCommentModel.deleteMany({ parent_comment_id: comment._id }).exec();

    // Delete the comment
    await comment.deleteOne();
    
    return { message: 'Comment deleted successfully' };
  }

  /**
   * Create a post as admin (with admin_post flag)
   */
  async createPostAsAdmin(adminId: string, dto: CreateForumPostDto): Promise<any> {
    const post = new this.forumPostModel({
      user_id: adminId,
      title: dto.title,
      description: dto.description,
      category: dto.category || undefined,
      is_anonymous: dto.is_anonymous || false,
      admin_post: true, // Mark as admin post
      likes_count: 0,
      comments_count: 0,
      views: 0,
    });
    await post.save();
    return this.formatPostResponse(post, adminId);
  }

  /**
   * Create a comment as admin (with admin_comment flag)
   */
  async createCommentAsAdmin(adminId: string, postId: string, dto: CreateCommentDto): Promise<any> {
    // Validate ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(postId)) {
      throw new NotFoundException('Invalid post ID format');
    }

    const post = await this.forumPostModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // If parent_comment_id is provided, validate it's a reply to a comment
    let parentComment: ForumCommentDocument | null = null;
    if (dto.parent_comment_id) {
      if (!/^[0-9a-fA-F]{24}$/.test(dto.parent_comment_id)) {
        throw new BadRequestException('Invalid parent comment ID format');
      }

      parentComment = await this.forumCommentModel.findById(dto.parent_comment_id).exec();
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.post_id.toString() !== postId) {
        throw new BadRequestException('Parent comment does not belong to this post');
      }

      // Admin can reply to any comment at any nesting level (unlimited nesting)
      // No restriction on parent_comment_id for admin
    }

    const comment = new this.forumCommentModel({
      post_id: postId,
      user_id: adminId,
      content: dto.content,
      is_anonymous: dto.is_anonymous || false,
      parent_comment_id: dto.parent_comment_id ? new Types.ObjectId(dto.parent_comment_id) : undefined,
      admin_comment: true, // Mark as admin comment
      likes_count: 0,
    });
    await comment.save();

    // Update comment count on post (only for top-level comments)
    if (!dto.parent_comment_id) {
      post.comments_count += 1;
      await post.save();
    }

    return await this.formatCommentResponse(comment);
  }

  /**
   * Get forum statistics for admin
   */
  async getForumStatsForAdmin(): Promise<any> {
    const [
      totalPosts,
      totalComments,
      totalLikes,
      totalUsers,
      postsToday,
      commentsToday,
    ] = await Promise.all([
      this.forumPostModel.countDocuments().exec(),
      this.forumCommentModel.countDocuments().exec(),
      this.forumLikeModel.countDocuments().exec(),
      this.forumPostModel.distinct('user_id').exec(),
      this.forumPostModel.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }).exec(),
      this.forumCommentModel.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }).exec(),
    ]);

    // Get category breakdown
    const categoryBreakdown = await this.forumPostModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      total_posts: totalPosts,
      total_comments: totalComments,
      total_likes: totalLikes,
      total_active_users: totalUsers.length,
      posts_today: postsToday,
      comments_today: commentsToday,
      category_breakdown: categoryBreakdown.map(item => ({
        category: item._id || 'Uncategorized',
        count: item.count,
      })),
    };
  }
}

