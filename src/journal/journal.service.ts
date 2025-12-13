import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Journal, JournalDocument } from '../models/schemas/journal.schema';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { AchievementService } from '../achievement/achievement.service';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';

@Injectable()
export class JournalService {
  constructor(
    @InjectModel(Journal.name) private journalModel: Model<JournalDocument>,
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
    @Inject(forwardRef(() => AchievementService))
    private readonly achievementService: AchievementService,
  ) {}

  async createOrUpdateJournal(userId: string, dto: CreateJournalDto) {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dto.date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    // Check if entry exists for this date
    const existing = await this.journalModel.findOne({
      user_id: userId,
      date: dto.date,
    });

    if (existing) {
      // Update existing entry
      existing.content = dto.content;
      if (dto.mood) {
        existing.mood = dto.mood;
      }
      await existing.save();

      // Check achievements after updating journal (async, don't block response)
      this.checkAchievementsAsync(userId);

      return {
        success: true,
        message: 'Journal entry updated successfully',
        data: this.formatJournalResponse(existing),
      };
    }

    // Create new entry
    const journal = new this.journalModel({
      user_id: userId,
      date: dto.date,
      content: dto.content,
      mood: dto.mood || 'neutral',
    });

    await journal.save();

    // Check achievements after saving journal (async, don't block response)
    this.checkAchievementsAsync(userId);

    return {
      success: true,
      message: 'Journal entry created successfully',
      data: this.formatJournalResponse(journal),
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

  async getTodayJournal(userId: string) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const journal = await this.journalModel.findOne({
      user_id: userId,
      date: today,
    });

    if (!journal) {
      return {
        success: true,
        data: null,
        message: 'No journal entry for today',
      };
    }

    return {
      success: true,
      data: this.formatJournalResponse(journal),
    };
  }

  async getJournalByDate(userId: string, date: string) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    const journal = await this.journalModel.findOne({
      user_id: userId,
      date,
    });

    if (!journal) {
      return {
        success: true,
        data: null,
        message: 'No journal entry found for this date',
      };
    }

    return {
      success: true,
      data: this.formatJournalResponse(journal),
    };
  }

  async getJournalEntries(userId: string, page: number = 1, limit: number = 10) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const [entries, total] = await Promise.all([
      this.journalModel
        .find({ user_id: userId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum)
        .exec(),
      this.journalModel.countDocuments({ user_id: userId }).exec(),
    ]);

    return {
      success: true,
      data: entries.map(entry => this.formatJournalResponse(entry)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getJournalByMonth(userId: string, year: number, month: number) {
    // Validate month (1-12)
    if (month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    // Validate year
    if (year < 2000 || year > 2100) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }

    // Create date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const entries = await this.journalModel
      .find({
        user_id: userId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ date: -1 })
      .exec();

    return {
      success: true,
      data: entries.map(entry => this.formatJournalResponse(entry)),
      count: entries.length,
    };
  }

  async getJournalById(userId: string, journalId: string) {
    if (!Types.ObjectId.isValid(journalId)) {
      throw new NotFoundException('Invalid journal entry ID');
    }

    const journal = await this.journalModel.findById(journalId).exec();

    if (!journal) {
      throw new NotFoundException('Journal entry not found');
    }

    if (journal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only access your own journal entries');
    }

    return {
      success: true,
      data: this.formatJournalResponse(journal),
    };
  }

  async updateJournal(userId: string, journalId: string, dto: UpdateJournalDto) {
    if (!Types.ObjectId.isValid(journalId)) {
      throw new NotFoundException('Invalid journal entry ID');
    }

    const journal = await this.journalModel.findById(journalId).exec();

    if (!journal) {
      throw new NotFoundException('Journal entry not found');
    }

    if (journal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only update your own journal entries');
    }

    if (dto.content !== undefined) {
      journal.content = dto.content;
    }

    if (dto.mood !== undefined) {
      journal.mood = dto.mood;
    }

    await journal.save();

    return {
      success: true,
      message: 'Journal entry updated successfully',
      data: this.formatJournalResponse(journal),
    };
  }

  async deleteJournal(userId: string, journalId: string) {
    if (!Types.ObjectId.isValid(journalId)) {
      throw new NotFoundException('Invalid journal entry ID');
    }

    const journal = await this.journalModel.findById(journalId).exec();

    if (!journal) {
      throw new NotFoundException('Journal entry not found');
    }

    if (journal.user_id.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own journal entries');
    }

    await journal.deleteOne();

    return {
      success: true,
      message: 'Journal entry deleted successfully',
    };
  }

  private formatJournalResponse(journal: JournalDocument): any {
    return {
      _id: journal._id,
      date: journal.date,
      content: journal.content,
      mood: journal.mood || 'neutral',
      created_at: (journal as any).createdAt,
      updated_at: (journal as any).updatedAt,
    };
  }
}

