import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserPlant, UserPlantDocument } from '../models/schemas/user-plant.schema';
import { WeeklyGoal, WeeklyGoalDocument } from '../models/schemas/weekly-goal.schema';
import { UserAchievement, UserAchievementDocument, UserAchievementStatus } from '../models/schemas/user-achievement.schema';
import { Achievement, AchievementDocument } from '../models/schemas/achievement.schema';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';

@Injectable()
export class WellnessService {
  private readonly logger = new Logger(WellnessService.name);

  // Plant level definitions
  private readonly PLANT_LEVELS = [
    { level: 1, name: 'Seed', xp_required: 0, description: 'Starting your journey' },
    { level: 2, name: 'Sprout', xp_required: 100, description: 'Developing well' },
    { level: 3, name: 'Seedling', xp_required: 1000, description: 'Growing strong' },
    { level: 4, name: 'Budding Plant', xp_required: 3000, description: 'Blossoming beautifully' },
    { level: 5, name: 'Flowering Plant', xp_required: 5000, description: 'Blooming beautifully' },
    { level: 6, name: 'Mature Plant', xp_required: 10000, description: 'Strong and resilient' },
  ];

  constructor(
    @InjectModel(UserPlant.name) private userPlantModel: Model<UserPlantDocument>,
    @InjectModel(WeeklyGoal.name) private weeklyGoalModel: Model<WeeklyGoalDocument>,
    @InjectModel(UserAchievement.name) private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
  ) {}

  /**
   * Calculate total XP from all claimed achievements
   */
  async calculateTotalXP(userId: string): Promise<number> {
    try {
      const userIdObj = new Types.ObjectId(userId);
      const claimedAchievements = await this.userAchievementModel
        .find({
          user_id: userIdObj,
          status: UserAchievementStatus.CLAIMED,
        })
        .populate('achievement_id')
        .lean()
        .exec();

      const totalXP = claimedAchievements.reduce((total, ua) => {
        const achievement = ua.achievement_id as any;
        return total + (achievement?.xp_reward || 0);
      }, 0);

      return totalXP;
    } catch (error) {
      this.logger.error(`Error calculating total XP for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get or create user plant record
   */
  async getOrCreateUserPlant(userId: string): Promise<UserPlantDocument> {
    const userIdObj = new Types.ObjectId(userId);
    let userPlant = await this.userPlantModel.findOne({ user_id: userIdObj }).exec();

    if (!userPlant) {
      // Create new user plant with initial values
      userPlant = new this.userPlantModel({
        user_id: userIdObj,
        current_level: 1,
        total_xp: 0,
      });
      await userPlant.save();
    }

    // Update XP from claimed achievements
    const totalXP = await this.calculateTotalXP(userId);
    const currentLevel = this.getCurrentLevel(totalXP);

    // Check if level increased
    if (currentLevel > userPlant.current_level) {
      userPlant.last_level_up_date = new Date();
      this.logger.log(`User ${userId} leveled up from ${userPlant.current_level} to ${currentLevel}`);
    }

    userPlant.current_level = currentLevel;
    userPlant.total_xp = totalXP;
    await userPlant.save();

    return userPlant;
  }

  /**
   * Determine current plant level based on total XP
   */
  private getCurrentLevel(totalXP: number): number {
    if (totalXP >= 10000) return 6;
    if (totalXP >= 5000) return 5;
    if (totalXP >= 3000) return 4;
    if (totalXP >= 1000) return 3;
    if (totalXP >= 100) return 2;
    return 1;
  }

  /**
   * Get current week start date (Monday)
   */
  private getCurrentWeekStart(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(today.setDate(diff));
    return monday;
  }

  /**
   * Get or create weekly goal for current week
   */
  async getOrCreateWeeklyGoal(userId: string): Promise<WeeklyGoalDocument> {
    const userIdObj = new Types.ObjectId(userId);
    const weekStart = this.getCurrentWeekStart();

    let weeklyGoal = await this.weeklyGoalModel
      .findOne({
        user_id: userIdObj,
        week_start_date: weekStart,
      })
      .exec();

    if (!weeklyGoal) {
      weeklyGoal = new this.weeklyGoalModel({
        user_id: userIdObj,
        target_steps: 6000, // Default weekly goal
        current_steps: 0,
        week_start_date: weekStart,
      });
      await weeklyGoal.save();
    }

    // Update current steps for this week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSteps = await this.stepsModel
      .find({
        user_id: userIdObj,
        date: {
          $gte: weekStart,
          $lt: weekEnd,
        },
      })
      .lean()
      .exec();

    const totalWeekSteps = weekSteps.reduce((sum, s) => sum + s.steps, 0);
    weeklyGoal.current_steps = totalWeekSteps;
    await weeklyGoal.save();

    return weeklyGoal;
  }

  /**
   * Get progress data for Progress tab
   */
  async getProgress(userId: string): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's steps
      const todaySteps = await this.stepsModel.findOne({
        user_id: userId,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      }).lean().exec();

      // Get current streak
      const streak = await this.calculateStreak(userId);
      const streakStatus = streak >= 7 ? 'on_fire' : streak >= 3 ? 'active' : 'inactive';

      // Get weekly goal
      const weeklyGoal = await this.getOrCreateWeeklyGoal(userId);

      // Get this week's activity (last 7 days)
      const weekStart = this.getCurrentWeekStart();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekSteps = await this.stepsModel
        .find({
          user_id: userId,
          date: {
            $gte: weekStart,
            $lt: weekEnd,
          },
        })
        .sort({ date: 1 })
        .lean()
        .exec();

      // Format week activity (Monday to Sunday)
      const daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
      const thisWeekActivity = [];

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dayName = daysOfWeek[i]; // Use index for correct order
        const dateStr = date.toISOString().split('T')[0];

        const daySteps = weekSteps.find(
          (s) => {
            const stepDate = new Date(s.date);
            stepDate.setHours(0, 0, 0, 0);
            return stepDate.getTime() === date.getTime();
          }
        );

        thisWeekActivity.push({
          day: dayName,
          date: dateStr,
          steps: daySteps?.steps || 0,
        });
      }

      return {
        today_steps: todaySteps?.steps || 0,
        day_streak: streak,
        streak_status: streakStatus,
        weekly_goal: {
          target: weeklyGoal.target_steps,
          current: weeklyGoal.current_steps,
          percentage: weeklyGoal.target_steps > 0
            ? Math.round((weeklyGoal.current_steps / weeklyGoal.target_steps) * 100 * 100) / 100
            : 0,
        },
        this_week_activity: thisWeekActivity,
      };
    } catch (error) {
      this.logger.error(`Error getting progress for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get pet growth data for Pet Growth tab
   */
  async getPetGrowth(userId: string): Promise<any> {
    try {
      const userPlant = await this.getOrCreateUserPlant(userId);
      const totalXP = userPlant.total_xp;
      const currentLevel = userPlant.current_level;
      const currentLevelInfo = this.PLANT_LEVELS[currentLevel - 1];

      // Get next level info
      const nextLevel = currentLevel < 6 ? currentLevel + 1 : 6;
      const nextLevelInfo = this.PLANT_LEVELS[nextLevel - 1];
      const xpNeeded = nextLevelInfo.xp_required - totalXP;
      const canLevelUp = totalXP >= nextLevelInfo.xp_required;

      // Build levels array with status and progress information
      const levels = this.PLANT_LEVELS.map((level) => {
        let status = 'locked';
        if (level.level < currentLevel) {
          status = 'unlocked';
        } else if (level.level === currentLevel) {
          status = 'current';
        }

        // Calculate progress for each level
        // Show current XP vs total XP needed for that level
        let currentXPForLevel = 0;
        let xpNeededForLevel = 0;
        let progressPercentage = 0;

        if (level.level < currentLevel) {
          // Already unlocked - 100% complete
          currentXPForLevel = level.xp_required;
          xpNeededForLevel = 0;
          progressPercentage = 100;
        } else {
          // Current or locked level - show progress towards this level
          currentXPForLevel = totalXP;
          xpNeededForLevel = Math.max(0, level.xp_required - totalXP);
          progressPercentage = level.xp_required > 0 
            ? Math.min(100, Math.round((totalXP / level.xp_required) * 100))
            : 0;
        }

        return {
          level: level.level,
          name: level.name,
          xp_required: level.xp_required,
          status,
          description: level.description,
          can_unlock: level.level === nextLevel ? canLevelUp : level.level < nextLevel,
          xp_needed: xpNeededForLevel,
          progress: {
            current_xp: currentXPForLevel,
            total_xp: level.xp_required,
            percentage: progressPercentage,
            xp_needed: xpNeededForLevel,
          },
        };
      });

      return {
        current_level: currentLevel,
        level_name: currentLevelInfo.name,
        current_xp: totalXP,
        xp_for_next_level: nextLevelInfo.xp_required,
        xp_needed: Math.max(0, xpNeeded),
        total_xp_earned: totalXP,
        can_level_up: canLevelUp,
        levels,
      };
    } catch (error) {
      this.logger.error(`Error getting pet growth for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's total earned XP
   */
  async getUserXP(userId: string): Promise<any> {
    try {
      const totalXP = await this.calculateTotalXP(userId);
      const userPlant = await this.getOrCreateUserPlant(userId);
      
      return {
        total_xp_earned: totalXP,
        current_level: userPlant.current_level,
        level_name: this.PLANT_LEVELS[userPlant.current_level - 1]?.name || 'Seed',
        xp_from_claimed_achievements: totalXP,
      };
    } catch (error) {
      this.logger.error(`Error getting user XP for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get rewards data for Rewards tab
   */
  async getRewards(userId: string): Promise<any> {
    try {
      const userIdObj = new Types.ObjectId(userId);

      // Get all user achievements with achievement details
      const userAchievements = await this.userAchievementModel
        .find({
          user_id: userIdObj,
          status: { $in: [UserAchievementStatus.UNLOCKED, UserAchievementStatus.CLAIMED] },
        })
        .populate('achievement_id')
        .sort({ unlocked_at: -1 })
        .lean()
        .exec();

      const rewards = userAchievements
        .filter((ua) => ua.unlocked_at) // Only include unlocked achievements
        .map((ua) => {
          const achievement = ua.achievement_id as any;
          return {
            id: achievement._id.toString(),
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
            status: ua.status,
            is_claimable: ua.status === UserAchievementStatus.UNLOCKED,
            xp_reward: achievement.xp_reward || 0,
            unlocked_at: ua.unlocked_at,
            claimed_at: ua.claimed_at || null,
          };
        });

      return {
        rewards,
      };
    } catch (error) {
      this.logger.error(`Error getting rewards for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate streak (same logic as StepsService)
   */
  private async calculateStreak(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const steps = await this.stepsModel.findOne({
        user_id: userId,
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
  }
}

