import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mood, MoodDocument } from '../models/schemas/mood.schema';
import { CreateMoodDto } from './dto/create-mood.dto';
import { UpdateMoodDto } from './dto/update-mood.dto';
import { AchievementService } from '../achievement/achievement.service';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';
import { GoalsService } from '../goals/goals.service';
import { GoalCategory } from '../models/schemas/goal.schema';

@Injectable()
export class MoodService {
  constructor(
    @InjectModel(Mood.name) private moodModel: Model<MoodDocument>,
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
    @Inject(forwardRef(() => AchievementService))
    private readonly achievementService: AchievementService,
    @Inject(forwardRef(() => GoalsService))
    private readonly goalsService: GoalsService,
  ) {}

  async createOrUpdateMood(userId: string, dto: CreateMoodDto) {
    const date = dto.date || new Date().toISOString().split('T')[0];

    const existing = await this.moodModel.findOne({
      user_id: userId,
      date,
    });

    if (existing) {
      if (dto.mood) existing.mood = dto.mood;
      if (dto.journal_entry !== undefined) existing.journal_entry = dto.journal_entry;
      await existing.save();

      // Check achievements after updating mood (async, don't block response)
      this.checkAchievementsAsync(userId);
      
      // Update Mood Tracking goals (async, don't block response)
      this.updateGoalsAsync(userId);

      return {
        success: true,
        message: 'Mood updated successfully',
        data: this.formatMoodResponse(existing),
      };
    }

    const mood = new this.moodModel({
      user_id: userId,
      date,
      mood: dto.mood,
      journal_entry: dto.journal_entry,
    });

    await mood.save();

    // Check achievements after saving mood (async, don't block response)
    this.checkAchievementsAsync(userId);
    
    // Update Mood Tracking goals (async, don't block response)
    this.updateGoalsAsync(userId);

    return {
      success: true,
      message: 'Mood saved successfully',
      data: this.formatMoodResponse(mood),
    };
  }

  private async checkAchievementsAsync(userId: string): Promise<void> {
    try {
      // Calculate streak from steps (same logic as StepsService)
      const streak = await this.calculateStreakFromSteps(userId);
      await this.achievementService.checkStreakAchievements(userId, streak);
    } catch (error) {
      // Don't fail the main operation if achievement check fails
      console.error('Error checking achievements:', error);
    }
  }

  private async updateGoalsAsync(userId: string): Promise<void> {
    try {
      await this.goalsService.updateGoalProgress(userId, GoalCategory.MOOD_TRACKING);
    } catch (error) {
      // Don't fail the main operation if goal update fails
      console.error('Error updating goals:', error);
    }
  }

  private async calculateStreakFromSteps(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const steps = await this.stepsModel.findOne({
        user_id: userId,
        date: { $gte: currentDate, $lt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000) }
      });

      if (steps && steps.steps > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  async getMood(userId: string, date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const mood = await this.moodModel.findOne({
      user_id: userId,
      date: targetDate,
    });

    if (!mood) {
      throw new NotFoundException('No mood data found for this date');
    }

    return {
      success: true,
      data: this.formatMoodResponse(mood),
    };
  }

  async getMoodHistory(userId: string, limit: number = 10, page: number = 1) {
    const skip = (page - 1) * limit;

    const moods = await this.moodModel
      .find({ user_id: userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.moodModel.countDocuments({ user_id: userId });

    return {
      success: true,
      data: {
        moods: moods.map((mood) => this.formatMoodResponse(mood)),
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      },
    };
  }

  async updateMood(userId: string, id: string, dto: UpdateMoodDto) {
    let mood;
    try {
      mood = await this.moodModel.findById(id);
    } catch (error) {
      throw new NotFoundException('Mood entry not found');
    }

    if (!mood) {
      throw new NotFoundException('Mood entry not found');
    }

    if (mood.user_id.toString() !== userId) {
      throw new ForbiddenException('You don\'t have permission to update this entry');
    }

    if (dto.mood !== undefined) mood.mood = dto.mood;
    if (dto.journal_entry !== undefined) mood.journal_entry = dto.journal_entry;

    await mood.save();

    return {
      success: true,
      message: 'Mood updated successfully',
      data: this.formatMoodResponse(mood),
    };
  }

  async deleteMood(userId: string, id: string) {
    let mood;
    try {
      mood = await this.moodModel.findById(id);
    } catch (error) {
      throw new NotFoundException('Mood entry not found');
    }

    if (!mood) {
      throw new NotFoundException('Mood entry not found');
    }

    if (mood.user_id.toString() !== userId) {
      throw new ForbiddenException('You don\'t have permission to delete this entry');
    }

    await this.moodModel.findByIdAndDelete(id);

    return {
      success: true,
      message: 'Mood entry deleted successfully',
    };
  }

  private formatMoodResponse(mood: MoodDocument) {
    return {
      id: mood._id.toString(),
      user_id: mood.user_id.toString(),
      date: mood.date,
      mood: mood.mood,
      journal_entry: mood.journal_entry || null,
      created_at: (mood as any).createdAt,
      updated_at: (mood as any).updatedAt,
    };
  }
}

