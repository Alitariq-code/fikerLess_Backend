import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';
import { User, UserDocument } from '../models/schemas/user.schema';
import { SyncStepsDto } from './dto/sync-steps.dto';
import { CreateStepsDto } from './dto/create-steps.dto';
import { UpdateStepsDto } from './dto/update-steps.dto';
import { StepsCalculator } from '../utils/steps-calculator';
import { AchievementService } from '../achievement/achievement.service';
import { GoalsService } from '../goals/goals.service';
import { GoalCategory } from '../models/schemas/goal.schema';
import { AchievementConditionType } from '../models/schemas/achievement.schema';

@Injectable()
export class StepsService {
  constructor(
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => AchievementService))
    private readonly achievementService: AchievementService,
    @Inject(forwardRef(() => GoalsService))
    private readonly goalsService: GoalsService,
  ) {}

  async syncSteps(userId: string, dto: SyncStepsDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userIdObj = new Types.ObjectId(userId);
    const groupedByDate = this.groupByDate(dto.entries);
    const results = [];
    let created = 0;
    let updated = 0;

    for (const [dateStr, entries] of Object.entries(groupedByDate)) {
      const totalSteps = entries.reduce((sum, e) => sum + e.steps, 0);
      const totalCalories = entries.reduce((sum, e) => sum + (e.calories_burned || 0), 0);
      const totalDistance = entries.reduce((sum, e) => sum + (e.distance_km || 0), 0);
      const date = new Date(dateStr);
      const userWeight = (user as any).weight || 70;

      const distanceKm = totalDistance > 0 ? totalDistance : StepsCalculator.calculateDistance(totalSteps);
      const caloriesBurned = totalCalories > 0 ? totalCalories : StepsCalculator.calculateCalories(totalSteps, userWeight);

      const existing = await this.stepsModel.findOne({
        user_id: userIdObj,
        date: { $gte: new Date(dateStr), $lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000) }
      });

      if (existing) {
        // Accumulate steps instead of replacing (mobile app sends increments)
        existing.steps = existing.steps + totalSteps;
        existing.calories_burned = (existing.calories_burned || 0) + caloriesBurned;
        existing.distance_km = (existing.distance_km || 0) + distanceKm;
        await existing.save();
        updated++;
        results.push({
          date: dateStr,
          status: 'updated',
          id: existing._id.toString(),
          steps: existing.steps,
          calories_burned: existing.calories_burned,
          distance_km: existing.distance_km,
          goal: existing.goal,
          percentage: ((existing.steps / existing.goal) * 100).toFixed(2)
        });
      } else {
        const newEntry = await this.stepsModel.create({
          user_id: userIdObj,
          steps: totalSteps,
          date: date,
          calories_burned: caloriesBurned,
          distance_km: distanceKm,
          goal: (user as any).daily_steps_goal || 10000
        });
        created++;
        results.push({
          date: dateStr,
          status: 'created',
          id: newEntry._id.toString(),
          steps: totalSteps,
          calories_burned: caloriesBurned,
          distance_km: distanceKm,
          goal: newEntry.goal,
          percentage: ((totalSteps / newEntry.goal) * 100).toFixed(2)
        });
      }
    }

    // Check achievements after syncing steps (async, don't block response)
    this.achievementService.checkAchievementsAfterAction(userId, [AchievementConditionType.STREAK_DAYS, AchievementConditionType.STEPS_TOTAL]);
    
    // Update Exercise goals (async, don't block response)
    this.updateGoalsAsync(userId);

    return {
      synced: results.length,
      created,
      updated,
      results
    };
  }

  async createSteps(userId: string, dto: CreateStepsDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const date = dto.date ? new Date(dto.date) : new Date();
    date.setHours(0, 0, 0, 0);

    const userWeight = (user as any).weight || 70;
    const distanceKm = dto.distance_km || StepsCalculator.calculateDistance(dto.steps);
    const caloriesBurned = dto.calories_burned || StepsCalculator.calculateCalories(dto.steps, userWeight);

    const userIdObj = new Types.ObjectId(userId);
    const existing = await this.stepsModel.findOne({
      user_id: userIdObj,
      date: { $gte: date, $lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) }
    });

    if (existing) {
      existing.steps = dto.steps;
      existing.calories_burned = caloriesBurned;
      existing.distance_km = distanceKm;
      await existing.save();

      // Check achievements after updating steps (async, don't block response)
      this.achievementService.checkAchievementsAfterAction(userId, [AchievementConditionType.STREAK_DAYS, AchievementConditionType.STEPS_TOTAL]);
      
      // Update Exercise goals (async, don't block response)
      this.updateGoalsAsync(userId);

      return {
        id: existing._id.toString(),
        user_id: userId,
        steps: existing.steps,
        date: date.toISOString().split('T')[0],
        calories_burned: existing.calories_burned,
        distance_km: existing.distance_km,
        goal: existing.goal,
        percentage: ((existing.steps / existing.goal) * 100).toFixed(2),
        goal_achieved: existing.steps >= existing.goal,
        remaining_steps: Math.max(0, existing.goal - existing.steps),
        created_at: (existing as any).createdAt,
        updated_at: (existing as any).updatedAt
      };
    }

    const newEntry = await this.stepsModel.create({
      user_id: userIdObj,
      steps: dto.steps,
      date: date,
      calories_burned: caloriesBurned,
      distance_km: distanceKm,
      goal: (user as any).daily_steps_goal || 10000
    });

    // Check achievements after saving steps (async, don't block response)
    this.achievementService.checkAchievementsAfterAction(userId, [AchievementConditionType.STREAK_DAYS, AchievementConditionType.STEPS_TOTAL]);
    
    // Update Exercise goals (async, don't block response)
    this.updateGoalsAsync(userId);

    return {
      id: newEntry._id.toString(),
      user_id: userId,
      steps: newEntry.steps,
      date: date.toISOString().split('T')[0],
      calories_burned: newEntry.calories_burned,
      distance_km: newEntry.distance_km,
      goal: newEntry.goal,
      percentage: ((newEntry.steps / newEntry.goal) * 100).toFixed(2),
      goal_achieved: newEntry.steps >= newEntry.goal,
      remaining_steps: Math.max(0, newEntry.goal - newEntry.steps),
      created_at: (newEntry as any).createdAt,
      updated_at: (newEntry as any).updatedAt
    };
  }


  private async updateGoalsAsync(userId: string): Promise<void> {
    try {
      await this.goalsService.updateGoalProgress(userId, GoalCategory.EXERCISE);
    } catch (error) {
      // Don't fail the main operation if goal update fails
      console.error('Error updating goals:', error);
    }
  }

  async getSteps(userId: string, date?: string) {
    const userIdObj = new Types.ObjectId(userId);
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setDate(targetDateEnd.getDate() + 1);

    const steps = await this.stepsModel.findOne({
      user_id: userIdObj,
      date: { $gte: targetDate, $lt: targetDateEnd }
    });

    // Return default response if no steps found instead of throwing error
    if (!steps) {
      const defaultGoal = 10000;
      return {
        id: null,
        user_id: userId,
        steps: 0,
        date: targetDate.toISOString().split('T')[0],
        calories_burned: 0,
        distance_km: 0,
        goal: defaultGoal,
        percentage: '0.00',
        goal_achieved: false,
        remaining_steps: defaultGoal,
        created_at: null,
        updated_at: null
      };
    }

    return {
      id: steps._id.toString(),
      user_id: userId,
      steps: steps.steps,
      date: steps.date.toISOString().split('T')[0],
      calories_burned: steps.calories_burned,
      distance_km: steps.distance_km,
      goal: steps.goal,
      percentage: ((steps.steps / steps.goal) * 100).toFixed(2),
      goal_achieved: steps.steps >= steps.goal,
      remaining_steps: Math.max(0, steps.goal - steps.steps),
      created_at: (steps as any).createdAt,
      updated_at: (steps as any).updatedAt
    };
  }

  async getHistory(userId: string, period: string = 'daily', startDate?: string, endDate?: string, limit: number = 30, page: number = 1) {
    const userIdObj = new Types.ObjectId(userId);
    const query: any = { user_id: userIdObj };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (period === 'daily') {
      const skip = (page - 1) * limit;
      const steps = await this.stepsModel.find(query).sort({ date: -1 }).limit(limit).skip(skip);
      const total = await this.stepsModel.countDocuments(query);

      const records = steps.map(s => ({
        id: s._id.toString(),
        date: s.date.toISOString().split('T')[0],
        steps: s.steps,
        calories_burned: s.calories_burned,
        distance_km: s.distance_km,
        goal: s.goal,
        percentage: ((s.steps / s.goal) * 100).toFixed(2),
        goal_achieved: s.steps >= s.goal
      }));

      const allSteps = await this.stepsModel.find(query);
      const totalSteps = allSteps.reduce((sum, s) => sum + s.steps, 0);
      const averageSteps = allSteps.length > 0 ? Math.round(totalSteps / allSteps.length) : 0;

      const goalAchievedDays = allSteps.filter(s => s.steps >= s.goal).length;
      const bestDay = allSteps.length > 0 ? allSteps.reduce((best, current) => current.steps > best.steps ? current : best) : null;

      return {
        period: 'daily',
        total_steps: totalSteps,
        average_steps: averageSteps,
        records,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_records: total,
          limit,
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        },
        summary: {
          total_days: allSteps.length,
          days_recorded: allSteps.length,
          days_goal_achieved: goalAchievedDays,
          best_day: bestDay ? {
            date: bestDay.date.toISOString().split('T')[0],
            steps: bestDay.steps
          } : null,
          current_streak: await this.calculateStreak(userId)
        }
      };
    }

    if (period === 'weekly') {
      const allSteps = await this.stepsModel.find(query).sort({ date: -1 });
      const weeklyData = this.groupByWeek(allSteps);
      return {
        period: 'weekly',
        records: weeklyData
      };
    }

    if (period === 'monthly') {
      const allSteps = await this.stepsModel.find(query).sort({ date: -1 });
      const monthlyData = this.groupByMonth(allSteps);
      return {
        period: 'monthly',
        records: monthlyData
      };
    }

    throw new BadRequestException('Invalid period. Use: daily, weekly, or monthly');
  }

  async updateSteps(userId: string, id: string, dto: UpdateStepsDto) {
    let steps;
    try {
      steps = await this.stepsModel.findById(id);
    } catch (error) {
      throw new NotFoundException('Steps entry not found');
    }
    if (!steps) {
      throw new NotFoundException('Steps entry not found');
    }

    if (steps.user_id.toString() !== userId) {
      throw new ForbiddenException('You don\'t have permission to update this entry');
    }

    const user = await this.userModel.findById(userId);
    const userWeight = (user as any)?.weight || 70;

    if (dto.steps !== undefined) {
      steps.steps = dto.steps;
      steps.calories_burned = dto.calories_burned || StepsCalculator.calculateCalories(dto.steps, userWeight);
      steps.distance_km = dto.distance_km || StepsCalculator.calculateDistance(dto.steps);
    } else {
      if (dto.calories_burned !== undefined) {
        steps.calories_burned = dto.calories_burned;
      }
      if (dto.distance_km !== undefined) {
        steps.distance_km = dto.distance_km;
      }
    }

    if (dto.date) {
      steps.date = new Date(dto.date);
    }

    await steps.save();

    return {
      id: steps._id.toString(),
      user_id: userId,
      steps: steps.steps,
      date: steps.date.toISOString().split('T')[0],
      calories_burned: steps.calories_burned,
      distance_km: steps.distance_km,
      goal: steps.goal,
      percentage: ((steps.steps / steps.goal) * 100).toFixed(2),
      goal_achieved: steps.steps >= steps.goal,
      created_at: (steps as any).createdAt,
      updated_at: (steps as any).updatedAt
    };
  }

  async deleteSteps(userId: string, id: string) {
    let steps;
    try {
      steps = await this.stepsModel.findById(id);
    } catch (error) {
      throw new NotFoundException('Steps entry not found');
    }
    if (!steps) {
      throw new NotFoundException('Steps entry not found');
    }

    if (steps.user_id.toString() !== userId) {
      throw new ForbiddenException('You don\'t have permission to delete this entry');
    }

    await this.stepsModel.deleteOne({ _id: id });
    return { message: 'Steps entry deleted successfully' };
  }

  async getStats(userId: string, period: number = 30, startDate?: string, endDate?: string) {
    const userIdObj = new Types.ObjectId(userId);
    const query: any = { user_id: userIdObj };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - period);
      query.date = { $gte: start, $lte: end };
    }

    const allSteps = await this.stepsModel.find(query);
    const totalSteps = allSteps.reduce((sum, s) => sum + s.steps, 0);
    const averageSteps = allSteps.length > 0 ? Math.round(totalSteps / allSteps.length) : 0;
    const totalCalories = allSteps.reduce((sum, s) => sum + (s.calories_burned || 0), 0);
    const totalDistance = allSteps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
    const goalAchievedDays = allSteps.filter(s => s.steps >= s.goal).length;
    const achievementRate = allSteps.length > 0 ? ((goalAchievedDays / allSteps.length) * 100).toFixed(2) : '0';

    const bestDay = allSteps.length > 0 ? allSteps.reduce((best, current) => current.steps > best.steps ? current : best) : null;

    const streak = await this.calculateStreak(userId);
    const longestStreak = await this.calculateLongestStreak(userId);

    return {
      period: startDate && endDate ? 'custom' : `last_${period}_days`,
      total_steps: totalSteps,
      average_daily_steps: averageSteps,
      total_calories: totalCalories,
      total_distance_km: Math.round(totalDistance * 100) / 100,
      days_recorded: allSteps.length,
      days_goal_achieved: goalAchievedDays,
      goal_achievement_rate: parseFloat(achievementRate),
      current_streak: streak,
      longest_streak: longestStreak,
      best_day: bestDay ? {
        date: bestDay.date.toISOString().split('T')[0],
        steps: bestDay.steps
      } : null,
      weekly_average: Math.round(totalSteps / (allSteps.length / 7)),
      monthly_average: Math.round(totalSteps / (allSteps.length / 30)),
      progress_trend: await this.calculateTrend(userId)
    };
  }

  async getCurrentStreak(userId: string) {
    const userIdObj = new Types.ObjectId(userId);
    const streak = await this.calculateStreak(userId);
    const longestStreak = await this.calculateLongestStreak(userId);
    const allSteps = await this.stepsModel.find({ user_id: userIdObj }).sort({ date: -1 });

    const lastActivity = allSteps.length > 0 ? allSteps[0] : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streakStartDate = null;
    if (lastActivity && streak > 0) {
      const startDate = new Date(lastActivity.date);
      startDate.setDate(startDate.getDate() - (streak - 1));
      streakStartDate = startDate.toISOString().split('T')[0];
    }

    const goalMetDays = allSteps.filter(s => s.steps >= s.goal).length;
    const goalNotMetDays = allSteps.length - goalMetDays;

    return {
      current_streak: streak,
      longest_streak: longestStreak,
      streak_start_date: streakStartDate,
      last_activity_date: lastActivity ? lastActivity.date.toISOString().split('T')[0] : null,
      goal_met_days: goalMetDays,
      goal_not_met_days: goalNotMetDays
    };
  }

  private groupByDate(entries: any[]): Record<string, any[]> {
    return entries.reduce((acc, entry) => {
      const date = entry.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(entry);
      return acc;
    }, {});
  }

  private groupByWeek(steps: StepsDocument[]): any[] {
    const weeks: Record<string, any[]> = {};

    steps.forEach(step => {
      const date = new Date(step.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        weeks[weekKey] = [];
      }
      weeks[weekKey].push(step);
    });

    return Object.entries(weeks).map(([weekStart, weekSteps]) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const totalSteps = weekSteps.reduce((sum, s) => sum + s.steps, 0);
      const avgSteps = Math.round(totalSteps / weekSteps.length);

      return {
        week: `${weekStart} to ${weekEnd.toISOString().split('T')[0]}`,
        week_number: Math.ceil((new Date(weekStart).getTime() - new Date(new Date(weekStart).getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)),
        total_steps: totalSteps,
        average_daily_steps: avgSteps,
        days: weekSteps.map(s => ({
          date: s.date.toISOString().split('T')[0],
          steps: s.steps
        }))
      };
    }).sort((a, b) => b.week.localeCompare(a.week));
  }

  private groupByMonth(steps: StepsDocument[]): any[] {
    const months: Record<string, StepsDocument[]> = {};

    steps.forEach(step => {
      const date = new Date(step.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!months[monthKey]) {
        months[monthKey] = [];
      }
      months[monthKey].push(step);
    });

    return Object.entries(months).map(([monthKey, monthSteps]) => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
      const totalSteps = monthSteps.reduce((sum, s) => sum + s.steps, 0);
      const avgSteps = Math.round(totalSteps / monthSteps.length);
      const totalCalories = monthSteps.reduce((sum, s) => sum + (s.calories_burned || 0), 0);
      const totalDistance = monthSteps.reduce((sum, s) => sum + (s.distance_km || 0), 0);
      const goalAchievedDays = monthSteps.filter(s => s.steps >= s.goal).length;

      return {
        month: `${monthName} ${year}`,
        total_steps: totalSteps,
        average_daily_steps: avgSteps,
        days_recorded: monthSteps.length,
        goal_achieved_days: goalAchievedDays,
        total_calories: totalCalories,
        total_distance_km: Math.round(totalDistance * 100) / 100
      };
    }).sort((a, b) => b.month.localeCompare(a.month));
  }

  private async calculateStreak(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
      const currentDateEnd = new Date(currentDate);
      currentDateEnd.setDate(currentDateEnd.getDate() + 1);
      
      const steps = await this.stepsModel.findOne({
        user_id: userIdObj,
        date: { $gte: currentDate, $lt: currentDateEnd }
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

  private async calculateLongestStreak(userId: string): Promise<number> {
    const userIdObj = new Types.ObjectId(userId);
    const allSteps = await this.stepsModel.find({ user_id: userIdObj }).sort({ date: 1 });
    if (allSteps.length === 0) return 0;

    let longestStreak = 0;
    let currentStreak = 1;

    for (let i = 1; i < allSteps.length; i++) {
      const prevDate = new Date(allSteps[i - 1].date);
      const currDate = new Date(allSteps[i].date);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }

    return Math.max(longestStreak, currentStreak);
  }

  private async calculateTrend(userId: string): Promise<string> {
    const userIdObj = new Types.ObjectId(userId);
    const allSteps = await this.stepsModel.find({ user_id: userIdObj }).sort({ date: -1 }).limit(14);
    if (allSteps.length < 7) return 'stable';

    const recent = allSteps.slice(0, 7);
    const previous = allSteps.slice(7, 14);

    const recentAvg = recent.reduce((sum, s) => sum + s.steps, 0) / recent.length;
    const previousAvg = previous.length > 0 ? previous.reduce((sum, s) => sum + s.steps, 0) / previous.length : recentAvg;

    const diff = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }
}

