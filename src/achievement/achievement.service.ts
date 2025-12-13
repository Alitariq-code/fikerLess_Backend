import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Achievement, AchievementDocument, AchievementConditionType } from '../models/schemas/achievement.schema';
import { UserAchievement, UserAchievementDocument, UserAchievementStatus } from '../models/schemas/user-achievement.schema';
import { ForumPost, ForumPostDocument } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentDocument } from '../models/schemas/forum-comment.schema';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(UserAchievement.name) private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(ForumPost.name) private forumPostModel: Model<ForumPostDocument>,
    @InjectModel(ForumComment.name) private forumCommentModel: Model<ForumCommentDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Check and update streak-based achievements
   */
  async checkStreakAchievements(userId: string, currentStreak: number): Promise<void> {
    try {
      const achievements = await this.achievementModel.find({
        condition_type: AchievementConditionType.STREAK_DAYS,
        is_active: true,
      }).exec();

      for (const achievement of achievements) {
        await this.updateAchievementProgress(
          userId,
          achievement._id.toString(),
          currentStreak,
          achievement.condition_value,
        );
      }
    } catch (error) {
      this.logger.error(`Error checking streak achievements for user ${userId}:`, error);
    }
  }

  /**
   * Check and update forum-based achievements
   */
  async checkForumAchievements(userId: string): Promise<void> {
    try {
      const helpCount = await this.countForumHelps(userId);
      
      const achievements = await this.achievementModel.find({
        condition_type: AchievementConditionType.FORUM_HELPS,
        is_active: true,
      }).exec();

      for (const achievement of achievements) {
        await this.updateAchievementProgress(
          userId,
          achievement._id.toString(),
          helpCount,
          achievement.condition_value,
        );
      }
    } catch (error) {
      this.logger.error(`Error checking forum achievements for user ${userId}:`, error);
    }
  }

  /**
   * Count how many times user helped others in forum
   */
  async countForumHelps(userId: string): Promise<number> {
    try {
      // Convert userId to ObjectId
      const userIdObj = new Types.ObjectId(userId);
      
      // Get all comments by this user
      const comments = await this.forumCommentModel.find({ user_id: userIdObj }).exec();
      
      if (comments.length === 0) {
        return 0;
      }

      // Get post IDs from comments
      const postIds = comments.map(c => c.post_id);
      
      // Get posts for those comments
      const posts = await this.forumPostModel.find({ _id: { $in: postIds } }).exec();
      
      // Create a map for quick lookup
      const postMap = new Map(posts.map(p => [p._id.toString(), p]));
      
      // Count comments where user commented on someone else's post
      let helpCount = 0;
      for (const comment of comments) {
        const post = postMap.get(comment.post_id.toString());
        if (post && post.user_id.toString() !== userId) {
          helpCount++;
        }
      }

      return helpCount;
    } catch (error) {
      this.logger.error(`Error counting forum helps for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Update achievement progress and unlock if target reached
   */
  private async updateAchievementProgress(
    userId: string,
    achievementId: string,
    currentProgress: number,
    targetProgress: number,
  ): Promise<void> {
    try {
      // Validate ObjectId formats
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.error(`Invalid userId format: ${userId}`);
        return;
      }
      if (!Types.ObjectId.isValid(achievementId)) {
        this.logger.error(`Invalid achievementId format: ${achievementId}`);
        return;
      }

      // Convert string IDs to ObjectId
      const userIdObj = new Types.ObjectId(userId);
      const achievementIdObj = new Types.ObjectId(achievementId);
      
      let userAchievement = await this.userAchievementModel.findOne({
        user_id: userIdObj,
        achievement_id: achievementIdObj,
      }).exec();

      const wasUnlocked = userAchievement?.status === UserAchievementStatus.UNLOCKED || 
                         userAchievement?.status === UserAchievementStatus.CLAIMED;

      if (!userAchievement) {
        // Create new user achievement record
        // Use upsert to handle concurrent creation attempts
        try {
          userAchievement = new this.userAchievementModel({
            user_id: userIdObj,
            achievement_id: achievementIdObj,
            progress_current: currentProgress,
            progress_target: targetProgress,
            status: currentProgress >= targetProgress 
              ? UserAchievementStatus.UNLOCKED 
              : (currentProgress > 0 ? UserAchievementStatus.IN_PROGRESS : UserAchievementStatus.LOCKED),
            unlocked_at: currentProgress >= targetProgress ? new Date() : undefined,
            last_updated: new Date(),
          });
          await userAchievement.save();
        } catch (saveError: any) {
          // Handle duplicate key error (concurrent creation)
          if (saveError.code === 11000) {
            // Record was created by another concurrent operation, fetch it
            userAchievement = await this.userAchievementModel.findOne({
              user_id: userIdObj,
              achievement_id: achievementIdObj,
            }).exec();
            
            if (!userAchievement) {
              // Still not found, retry once
              await new Promise(resolve => setTimeout(resolve, 100));
              userAchievement = await this.userAchievementModel.findOne({
                user_id: userIdObj,
                achievement_id: achievementIdObj,
              }).exec();
            }
            
            if (userAchievement) {
              // Update the existing record with latest progress
              userAchievement.progress_current = Math.max(userAchievement.progress_current, currentProgress);
              userAchievement.progress_target = targetProgress;
              userAchievement.last_updated = new Date();
              
              if (currentProgress >= targetProgress && !wasUnlocked) {
                userAchievement.status = UserAchievementStatus.UNLOCKED;
                if (!userAchievement.unlocked_at) {
                  userAchievement.unlocked_at = new Date();
                }
              } else if (currentProgress > 0 && userAchievement.status === UserAchievementStatus.LOCKED) {
                userAchievement.status = UserAchievementStatus.IN_PROGRESS;
              }
              
              await userAchievement.save();
            }
          } else {
            throw saveError;
          }
        }
      } else {
        // Update existing record
        // Use max to ensure we don't overwrite higher progress from concurrent updates
        userAchievement.progress_current = Math.max(userAchievement.progress_current, currentProgress);
        userAchievement.progress_target = targetProgress;
        userAchievement.last_updated = new Date();

        // Update status based on progress
        if (currentProgress >= targetProgress && !wasUnlocked) {
          userAchievement.status = UserAchievementStatus.UNLOCKED;
          if (!userAchievement.unlocked_at) {
            userAchievement.unlocked_at = new Date();
          }
        } else if (currentProgress > 0 && userAchievement.status === UserAchievementStatus.LOCKED) {
          userAchievement.status = UserAchievementStatus.IN_PROGRESS;
        }
        
        await userAchievement.save();
      }

      // Send notification if just unlocked (only if we have a valid userAchievement)
      if (userAchievement && userAchievement.status === UserAchievementStatus.UNLOCKED && !wasUnlocked) {
        const achievement = await this.achievementModel.findById(achievementId).exec();
        if (achievement) {
          await this.notificationService.createDirectNotification(
            userId,
            `Achievement Unlocked: ${achievement.name}`,
            `Congratulations! You've unlocked "${achievement.description}"`,
            'achievement_unlock',
            {
              achievement_id: achievementId,
              achievement_name: achievement.name,
              achievement_icon: achievement.icon,
            },
            '/profile/achievements',
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error updating achievement progress for user ${userId}, achievement ${achievementId}:`, error);
    }
  }

  /**
   * Get recent achievements for user
   */
  async getRecentAchievements(userId: string, limit: number = 2): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Validate userId format
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      // Validate and clamp limit
      if (limit < 1) limit = 1;
      if (limit > 100) limit = 100;

      const userIdObj = new Types.ObjectId(userId);
      const userAchievements = await this.userAchievementModel
        .find({
          user_id: userIdObj,
          status: { $in: [UserAchievementStatus.UNLOCKED, UserAchievementStatus.CLAIMED] },
        })
        .sort({ unlocked_at: -1 })
        .limit(limit)
        .populate('achievement_id')
        .exec();

      const result = userAchievements
        .filter(ua => ua.unlocked_at) // Only include unlocked ones
        .map(ua => {
          const achievement = ua.achievement_id as any;
          return {
            id: achievement._id.toString(),
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            status: ua.status,
            unlocked_at: ua.unlocked_at,
          };
        });

      const duration = Date.now() - startTime;
      this.logger.debug(`getRecentAchievements completed for user ${userId} in ${duration}ms, returned ${result.length} achievements`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`getRecentAchievements failed for user ${userId} after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Get all achievements with progress for user (with pagination)
   */
  async getAllAchievements(
    userId: string,
    status?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Validate userId format
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }

      const userIdObj = new Types.ObjectId(userId);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get all active achievements (with pagination)
    const allAchievementsQuery = this.achievementModel
      .find({ is_active: true })
      .sort({ order: 1, createdAt: 1 });

    // Get total count for pagination
    const totalAchievements = await this.achievementModel.countDocuments({ is_active: true }).exec();
    
    // Apply pagination
    const allAchievements = await allAchievementsQuery
      .skip(skip)
      .limit(limit)
      .exec();

    // Get user's achievement progress
    const userAchievements = await this.userAchievementModel
      .find({ user_id: userIdObj })
      .exec();

    // Create a map for quick lookup
    const userAchievementMap = new Map(
      userAchievements.map(ua => [ua.achievement_id.toString(), ua])
    );

    // Combine achievements with user progress
    const achievementsWithProgress = await Promise.all(
      allAchievements.map(async (achievement) => {
        const userAchievement = userAchievementMap.get(achievement._id.toString());

        // Default values if no user achievement record exists
        const progressCurrent = userAchievement?.progress_current || 0;
        const progressTarget = userAchievement?.progress_target || achievement.condition_value;
        const achievementStatus = userAchievement?.status || UserAchievementStatus.LOCKED;
        const unlockedAt = userAchievement?.unlocked_at || null;
        const claimedAt = userAchievement?.claimed_at || null;

        const percentage = progressTarget > 0
          ? Math.min(100, (progressCurrent / progressTarget) * 100)
          : 0;

        return {
          id: achievement._id.toString(),
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          status: achievementStatus,
          progress: {
            current: progressCurrent,
            target: progressTarget,
            percentage: Math.round(percentage * 100) / 100,
          },
          unlocked_at: unlockedAt,
          claimed_at: claimedAt,
          xp_reward: achievement.xp_reward,
        };
      })
    );

    // Filter by status if provided
    let filteredAchievements = achievementsWithProgress;
    if (status && status !== 'all') {
      // Only filter if status is a valid UserAchievementStatus
      const validStatuses = ['locked', 'in_progress', 'unlocked', 'claimed'];
      if (validStatuses.includes(status)) {
        filteredAchievements = achievementsWithProgress.filter(a => a.status === status);
      }
      // If invalid status, return all achievements (ignore invalid filter)
    }

    // Count unlocked achievements (from all achievements, not just current page)
    const allUserAchievements = await this.userAchievementModel
      .find({ user_id: userIdObj })
      .populate('achievement_id')
      .exec();
    
    const unlockedCount = allUserAchievements.filter(
      ua => ua.status === UserAchievementStatus.UNLOCKED || ua.status === UserAchievementStatus.CLAIMED
    ).length;

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalAchievements / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const result = {
      total_achievements: totalAchievements,
      unlocked_count: unlockedCount,
      pagination: {
        page,
        limit,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage,
      },
      achievements: filteredAchievements,
    };

    const duration = Date.now() - startTime;
    this.logger.debug(`getAllAchievements completed for user ${userId} in ${duration}ms, page ${page}, returned ${filteredAchievements.length} achievements`);
    
    return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`getAllAchievements failed for user ${userId} after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Claim an achievement (mark as claimed and award XP if needed)
   */
  async claimAchievement(userId: string, achievementId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Validate ObjectId formats
      if (!Types.ObjectId.isValid(userId)) {
        throw new BadRequestException('Invalid user ID format');
      }
      if (!Types.ObjectId.isValid(achievementId)) {
        throw new BadRequestException('Invalid achievement ID format');
      }

      const userIdObj = new Types.ObjectId(userId);
      const achievementIdObj = new Types.ObjectId(achievementId);
      
      const userAchievement = await this.userAchievementModel.findOne({
        user_id: userIdObj,
        achievement_id: achievementIdObj,
      }).populate('achievement_id').exec();

      if (!userAchievement) {
        throw new NotFoundException('Achievement not found for this user');
      }

      if (userAchievement.status !== UserAchievementStatus.UNLOCKED) {
        throw new NotFoundException('Achievement is not unlocked yet');
      }

      userAchievement.status = UserAchievementStatus.CLAIMED;
      userAchievement.claimed_at = new Date();
      await userAchievement.save();

      const achievement = userAchievement.achievement_id as any;

      // Send notification when achievement is claimed
      try {
        await this.notificationService.createDirectNotification(
          userId,
          `Achievement Claimed: ${achievement.name}`,
          `You've claimed "${achievement.description}" and earned ${achievement.xp_reward} XP!`,
          'achievement_claimed',
          {
            achievement_id: achievementId,
            achievement_name: achievement.name,
            achievement_icon: achievement.icon,
            xp_reward: achievement.xp_reward,
          },
          '/profile/achievements',
        );
        this.logger.debug(`Notification sent for claimed achievement ${achievementId} to user ${userId}`);
      } catch (error) {
        // Don't fail the claim operation if notification fails
        this.logger.error(`Failed to send claim notification for achievement ${achievementId} to user ${userId}:`, error);
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Achievement ${achievementId} claimed by user ${userId} in ${duration}ms (XP: ${achievement.xp_reward})`);

      return {
        success: true,
        message: 'Achievement claimed successfully',
        achievement: {
          id: achievement._id.toString(),
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          xp_reward: achievement.xp_reward,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`claimAchievement failed for user ${userId}, achievement ${achievementId} after ${duration}ms:`, error);
      throw error;
    }
  }
}

