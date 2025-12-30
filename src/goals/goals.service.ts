import { Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Goal, GoalDocument, GoalStatus, GoalCategory, GoalFrequency } from '../models/schemas/goal.schema';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
  ) {}

  async createGoal(userId: string, dto: CreateGoalDto): Promise<any> {
    // Validate that custom_category is provided when category is 'Other'
    if (dto.category === 'Other' && (!dto.custom_category || dto.custom_category.trim() === '')) {
      throw new BadRequestException('custom_category is required when category is "Other"');
    }

    const goal = new this.goalModel({
      user_id: userId,
      title: dto.title,
      category: dto.category,
      custom_category: dto.custom_category,
      frequency: dto.frequency,
      status: GoalStatus.IN_PROGRESS,
      current_streak: 0,
      target_streak: dto.target_streak,
    });

    // Validate custom_category when creating with 'Other'
    if (goal.category === 'Other' && (!goal.custom_category || goal.custom_category.trim() === '')) {
      throw new BadRequestException('custom_category is required when category is "Other"');
    }

    await goal.save();
    return this.formatGoalResponse(goal);
  }

  async getGoals(userId: string, status?: string): Promise<any> {
    const filter: any = { user_id: userId };
    
    if (status && status !== 'all') {
      if (status === 'in_progress' || status === 'completed') {
        filter.status = status;
      }
    }

    const goals = await this.goalModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    const activeGoals = goals.filter(g => g.status === GoalStatus.IN_PROGRESS);
    const totalGoals = goals.length;

    return {
      summary: {
        active_goals: activeGoals.length,
        total_goals: totalGoals,
      },
      data: goals.map(goal => this.formatGoalResponse(goal)),
    };
  }

  async getGoalById(userId: string, goalId: string): Promise<any> {
    if (!Types.ObjectId.isValid(goalId)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only access your own goals');
    }

    return this.formatGoalResponse(goal);
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto): Promise<any> {
    if (!Types.ObjectId.isValid(goalId)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only update your own goals');
    }

    if (dto.title !== undefined) goal.title = dto.title;
    if (dto.category !== undefined) goal.category = dto.category;
    if (dto.custom_category !== undefined) goal.custom_category = dto.custom_category;
    if (dto.frequency !== undefined) goal.frequency = dto.frequency;
    if (dto.target_streak !== undefined) goal.target_streak = dto.target_streak;

    // Validate custom_category when updating to 'Other'
    if (goal.category === 'Other' && (!goal.custom_category || goal.custom_category.trim() === '')) {
      throw new BadRequestException('custom_category is required when category is "Other"');
    }

    await goal.save();
    return this.formatGoalResponse(goal);
  }

  async completeGoal(userId: string, goalId: string): Promise<any> {
    if (!Types.ObjectId.isValid(goalId)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only complete your own goals');
    }

    if (goal.status === GoalStatus.COMPLETED) {
      throw new BadRequestException('Goal is already completed');
    }

    goal.status = GoalStatus.COMPLETED;
    goal.completed_at = new Date();
    await goal.save();

    return this.formatGoalResponse(goal);
  }

  async deleteGoal(userId: string, goalId: string): Promise<any> {
    if (!Types.ObjectId.isValid(goalId)) {
      throw new BadRequestException('Invalid goal ID format');
    }

    const goal = await this.goalModel.findById(goalId).exec();
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (goal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own goals');
    }

    await goal.deleteOne();
    return { message: 'Goal deleted successfully' };
  }

  async updateGoalProgress(userId: string, category: GoalCategory): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all in-progress goals for this user matching the category
      const goals = await this.goalModel.find({
        user_id: userId,
        category: category,
        status: GoalStatus.IN_PROGRESS,
      }).exec();

      for (const goal of goals) {
        const lastCompleted = goal.last_completed_date
          ? new Date(goal.last_completed_date)
          : null;

        if (lastCompleted) {
          lastCompleted.setHours(0, 0, 0, 0);
        }

        const daysDiff = lastCompleted
          ? Math.floor((today.getTime() - lastCompleted.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        // Check if goal should be updated based on frequency
        let shouldUpdate = false;
        let isContinuingStreak = false;

        if (goal.frequency === GoalFrequency.DAILY) {
          // For daily goals, update if last completed was yesterday (continuing streak) or earlier (new streak)
          if (!lastCompleted) {
            // First time completing - start streak
            shouldUpdate = true;
            isContinuingStreak = false;
          } else if (daysDiff === 1) {
            // Continuing streak - completed yesterday, completing today
            shouldUpdate = true;
            isContinuingStreak = true;
          } else if (daysDiff === 0) {
            // Already completed today - don't update
            shouldUpdate = false;
          } else {
            // Missed days - reset streak
            shouldUpdate = true;
            isContinuingStreak = false;
          }
        } else if (goal.frequency === GoalFrequency.WEEKLY) {
          // For weekly goals, update if last completed was 7+ days ago or exactly 7 days (continuing)
          if (!lastCompleted) {
            // First time completing
            shouldUpdate = true;
            isContinuingStreak = false;
          } else if (daysDiff >= 7) {
            // It's been a week or more
            shouldUpdate = true;
            isContinuingStreak = daysDiff === 7; // Only continuing if exactly 7 days
          } else {
            // Less than a week - don't update yet
            shouldUpdate = false;
          }
        }

        if (shouldUpdate) {
          if (isContinuingStreak) {
            // Continuing streak
            goal.current_streak += 1;
          } else {
            // Starting new streak (first time or after missing)
            goal.current_streak = 1;
          }

          goal.last_completed_date = today;
          await goal.save();

          this.logger.log(`Updated progress for goal ${goal._id}: streak=${goal.current_streak}, category=${category}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error updating goal progress for user ${userId}, category ${category}:`, error);
    }
  }

  private formatGoalResponse(goal: GoalDocument): any {
    return {
      _id: goal._id,
      title: goal.title,
      category: goal.category,
      custom_category: goal.custom_category || null,
      frequency: goal.frequency,
      status: goal.status,
      current_streak: goal.current_streak,
      target_streak: goal.target_streak,
      completed_at: goal.completed_at,
      last_completed_date: goal.last_completed_date,
      created_at: (goal as any).createdAt,
      updated_at: (goal as any).updatedAt,
    };
  }
}

