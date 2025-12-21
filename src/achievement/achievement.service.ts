import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Achievement, AchievementDocument, AchievementConditionType } from '../models/schemas/achievement.schema';
import { UserAchievement, UserAchievementDocument, UserAchievementStatus } from '../models/schemas/user-achievement.schema';
import { ForumPost, ForumPostDocument } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentDocument } from '../models/schemas/forum-comment.schema';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';
import { Mood, MoodDocument } from '../models/schemas/mood.schema';
import { Journal, JournalDocument } from '../models/schemas/journal.schema';
import { NotificationService } from '../notification/notification.service';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  // Progress calculators map for generic achievement tracking
  private readonly progressCalculators: Map<
    AchievementConditionType,
    (userId: string) => Promise<number>
  > = new Map();

  constructor(
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(UserAchievement.name) private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(ForumPost.name) private forumPostModel: Model<ForumPostDocument>,
    @InjectModel(ForumComment.name) private forumCommentModel: Model<ForumCommentDocument>,
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
    @InjectModel(Mood.name) private moodModel: Model<MoodDocument>,
    @InjectModel(Journal.name) private journalModel: Model<JournalDocument>,
    private readonly notificationService: NotificationService,
  ) {
    // Initialize progress calculators for each condition type
    this.initializeProgressCalculators();
  }

  /**
   * Initialize progress calculators for all condition types
   * Add new condition types here and they'll be automatically tracked!
   */
  private initializeProgressCalculators(): void {
    // STREAK_DAYS: Calculate consecutive days with steps
    this.progressCalculators.set(
      AchievementConditionType.STREAK_DAYS,
      async (userId: string) => this.calculateStreak(userId),
    );

    // FORUM_HELPS: Count helpful forum comments
    this.progressCalculators.set(
      AchievementConditionType.FORUM_HELPS,
      async (userId: string) => this.countForumHelps(userId),
    );

    // STEPS_TOTAL: Calculate total steps ever
    this.progressCalculators.set(
      AchievementConditionType.STEPS_TOTAL,
      async (userId: string) => this.calculateTotalSteps(userId),
    );

    // MOOD_DAYS: Count days with mood entries
    this.progressCalculators.set(
      AchievementConditionType.MOOD_DAYS,
      async (userId: string) => this.countMoodDays(userId),
    );

    // JOURNAL_DAYS: Count days with journal entries
    this.progressCalculators.set(
      AchievementConditionType.JOURNAL_DAYS,
      async (userId: string) => this.countJournalDays(userId),
    );
  }

  /**
   * 🎯 GENERIC METHOD: Check ALL achievements for a user
   * This automatically tracks ANY achievement in the database!
   * 
   * @param userId - User ID to check achievements for
   * @param conditionTypes - Optional: Only check specific condition types (for performance)
   */
  async checkAllAchievements(
    userId: string,
    conditionTypes?: AchievementConditionType[],
  ): Promise<void> {
    try {
      // Build query for active achievements
      const query: any = { is_active: true };
      
      // If specific condition types provided, filter by them
      if (conditionTypes && conditionTypes.length > 0) {
        query.condition_type = { $in: conditionTypes };
      }

      // Get all active achievements (matching condition types if specified)
      const achievements = await this.achievementModel.find(query).exec();

      if (achievements.length === 0) {
        return;
      }

      // Group achievements by condition type for efficient calculation
      const achievementsByType = new Map<AchievementConditionType, AchievementDocument[]>();
      
      for (const achievement of achievements) {
        const conditionType = achievement.condition_type;
        if (!achievementsByType.has(conditionType)) {
          achievementsByType.set(conditionType, []);
        }
        achievementsByType.get(conditionType)!.push(achievement);
      }

      // Process each condition type
      for (const [conditionType, typeAchievements] of achievementsByType) {
        const calculator = this.progressCalculators.get(conditionType);
        
        if (!calculator) {
          this.logger.warn(
            `No progress calculator found for condition type: ${conditionType}. ` +
            `Achievement tracking skipped for ${typeAchievements.length} achievement(s).`
          );
          continue;
        }

        try {
          // Calculate current progress for this condition type
          const currentProgress = await calculator(userId);

          // Update all achievements of this type
          for (const achievement of typeAchievements) {
            await this.updateAchievementProgress(
              userId,
              achievement._id.toString(),
              currentProgress,
              achievement.condition_value,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error calculating progress for condition type ${conditionType} for user ${userId}:`,
            error,
          );
          // Continue with other condition types even if one fails
        }
      }
    } catch (error) {
      this.logger.error(`Error checking all achievements for user ${userId}:`, error);
    }
  }

  /**
   * 🚀 MAIN ENTRY POINT: Check achievements after user action
   * Call this from any service when user performs an action
   * 
   * @param userId - User ID
   * @param triggerTypes - Condition types that might be affected by this action
   *                      (for performance - only check relevant achievements)
   */
  async checkAchievementsAfterAction(
    userId: string,
    triggerTypes?: AchievementConditionType[],
  ): Promise<void> {
    // Fire and forget - don't block the main operation
    this.checkAllAchievements(userId, triggerTypes).catch((error) => {
      this.logger.error(`Background achievement check failed for user ${userId}:`, error);
    });
  }

  // ==================== PROGRESS CALCULATORS ====================

  /**
   * Calculate streak (consecutive days with steps > 0)
   */
  private async calculateStreak(userId: string): Promise<number> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streak = 0;
      let currentDate = new Date(today);

      while (true) {
        const steps = await this.stepsModel.findOne({
          user_id: userIdObj,
          date: {
            $gte: currentDate,
            $lt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000),
          },
        }).lean().exec();

        if (steps && steps.steps > 0) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      this.logger.error(`Error calculating streak for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Calculate total steps ever recorded
   */
  private async calculateTotalSteps(userId: string): Promise<number> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      const allSteps = await this.stepsModel.find({ user_id: userIdObj }).lean().exec();
      return allSteps.reduce((total, step) => total + (step.steps || 0), 0);
    } catch (error) {
      this.logger.error(`Error calculating total steps for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Count days with mood entries
   */
  private async countMoodDays(userId: string): Promise<number> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      const count = await this.moodModel.countDocuments({ user_id: userIdObj }).exec();
      return count;
    } catch (error) {
      this.logger.error(`Error counting mood days for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Count days with journal entries
   */
  private async countJournalDays(userId: string): Promise<number> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      const count = await this.journalModel.countDocuments({ user_id: userIdObj }).exec();
      return count;
    } catch (error) {
      this.logger.error(`Error counting journal days for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * @deprecated Use checkAchievementsAfterAction() instead
   * Kept for backward compatibility
   */
  async checkStreakAchievements(userId: string, currentStreak?: number): Promise<void> {
    if (currentStreak !== undefined) {
      // If streak provided, use it directly (for performance)
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
    } else {
      // Otherwise use generic method
      await this.checkAllAchievements(userId, [AchievementConditionType.STREAK_DAYS]);
    }
  }

  /**
   * @deprecated Use checkAchievementsAfterAction() instead
   * Kept for backward compatibility
   */
  async checkForumAchievements(userId: string): Promise<void> {
    await this.checkAllAchievements(userId, [AchievementConditionType.FORUM_HELPS]);
  }

  /**
   * Count how many times user helped others in forum
   * Public for testing purposes
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

  // Admin methods
  async getAllAchievementsForAdmin(
    search?: string,
    category?: string,
    conditionType?: string,
    isActive?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (category && category !== 'all') {
      query.category = category;
    }

    if (conditionType && conditionType !== 'all') {
      query.condition_type = conditionType;
    }

    if (isActive !== undefined && isActive !== 'all') {
      query.is_active = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [achievements, total] = await Promise.all([
      this.achievementModel
        .find(query)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.achievementModel.countDocuments(query),
    ]);

    return {
      data: achievements.map((achievement) => ({
        _id: achievement._id.toString(),
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        condition_type: achievement.condition_type,
        condition_value: achievement.condition_value,
        xp_reward: achievement.xp_reward || 0,
        is_active: achievement.is_active,
        order: achievement.order || 0,
        created_at: (achievement as any).createdAt,
        updated_at: (achievement as any).updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }

  async getAchievementByIdForAdmin(achievementId: string) {
    const achievement = await this.achievementModel.findById(achievementId).lean();
    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }
    return {
      _id: achievement._id.toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      condition_type: achievement.condition_type,
      condition_value: achievement.condition_value,
      xp_reward: achievement.xp_reward || 0,
      is_active: achievement.is_active,
      order: achievement.order || 0,
      created_at: (achievement as any).createdAt,
      updated_at: (achievement as any).updatedAt,
    };
  }

  async createAchievementAsAdmin(dto: CreateAchievementDto) {
    // Check if achievement with same name already exists
    const existing = await this.achievementModel.findOne({ name: dto.name }).exec();
    if (existing) {
      throw new BadRequestException('An achievement with this name already exists');
    }

    const achievement = await this.achievementModel.create({
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      category: dto.category,
      condition_type: dto.condition_type,
      condition_value: dto.condition_value,
      xp_reward: dto.xp_reward || 0,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      order: dto.order || 0,
    });

    return {
      _id: achievement._id.toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      condition_type: achievement.condition_type,
      condition_value: achievement.condition_value,
      xp_reward: achievement.xp_reward || 0,
      is_active: achievement.is_active,
      order: achievement.order || 0,
      created_at: (achievement as any).createdAt,
      updated_at: (achievement as any).updatedAt,
    };
  }

  async updateAchievementAsAdmin(achievementId: string, dto: UpdateAchievementDto) {
    const achievement = await this.achievementModel.findById(achievementId);
    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    // Check if name is being changed and if new name already exists
    if (dto.name && dto.name !== achievement.name) {
      const existing = await this.achievementModel.findOne({ name: dto.name, _id: { $ne: achievementId } }).exec();
      if (existing) {
        throw new BadRequestException('An achievement with this name already exists');
      }
    }

    if (dto.name !== undefined) achievement.name = dto.name;
    if (dto.description !== undefined) achievement.description = dto.description;
    if (dto.icon !== undefined) achievement.icon = dto.icon;
    if (dto.category !== undefined) achievement.category = dto.category;
    if (dto.condition_type !== undefined) achievement.condition_type = dto.condition_type;
    if (dto.condition_value !== undefined) achievement.condition_value = dto.condition_value;
    if (dto.xp_reward !== undefined) achievement.xp_reward = dto.xp_reward;
    if (dto.is_active !== undefined) achievement.is_active = dto.is_active;
    if (dto.order !== undefined) achievement.order = dto.order;

    await achievement.save();

    return {
      _id: achievement._id.toString(),
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      condition_type: achievement.condition_type,
      condition_value: achievement.condition_value,
      xp_reward: achievement.xp_reward || 0,
      is_active: achievement.is_active,
      order: achievement.order || 0,
      created_at: (achievement as any).createdAt,
      updated_at: (achievement as any).updatedAt,
    };
  }

  async deleteAchievementAsAdmin(achievementId: string) {
    const achievement = await this.achievementModel.findById(achievementId);
    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    // Check if any users have this achievement
    const userAchievementCount = await this.userAchievementModel.countDocuments({
      achievement_id: achievementId,
    }).exec();

    if (userAchievementCount > 0) {
      throw new BadRequestException(
        `Cannot delete achievement. ${userAchievementCount} user(s) have this achievement. Consider deactivating it instead.`
      );
    }

    await achievement.deleteOne();
    return { success: true, message: 'Achievement deleted successfully' };
  }

  async getAllUserAchievementsForAdmin(
    userId?: string,
    achievementId?: string,
    status?: string,
    page: number = 1,
    limit: number = 1000,
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (userId) {
      query.user_id = new Types.ObjectId(userId);
    }

    if (achievementId) {
      query.achievement_id = new Types.ObjectId(achievementId);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const [userAchievements, total] = await Promise.all([
      this.userAchievementModel
        .find(query)
        .populate('user_id', 'email first_name last_name username')
        .populate('achievement_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userAchievementModel.countDocuments(query),
    ]);

    const data = userAchievements.map((ua: any) => {
      const user = ua.user_id;
      const achievement = ua.achievement_id;
      return {
        _id: ua._id.toString(),
        user: user ? {
          _id: user._id.toString(),
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
        } : null,
        achievement: achievement ? {
          _id: achievement._id.toString(),
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
        } : null,
        progress_current: ua.progress_current || 0,
        progress_target: ua.progress_target,
        progress_percentage: ua.progress_target > 0 
          ? Math.round((ua.progress_current / ua.progress_target) * 100) 
          : 0,
        status: ua.status,
        unlocked_at: ua.unlocked_at,
        claimed_at: ua.claimed_at,
        last_updated: ua.last_updated,
        created_at: (ua as any).createdAt,
        updated_at: (ua as any).updatedAt,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
    };
  }
}

