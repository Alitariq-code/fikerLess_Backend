import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';
import { Demographics, DemographicsDocument } from '../models/schemas/demographics.schema';
import { Session, SessionDocument } from '../models/schemas/session.schema';
import { SessionRequest, SessionRequestDocument } from '../models/schemas/session-request.schema';
import { SpecialistProfile, SpecialistProfileDocument } from '../models/schemas/specialist-profile.schema';
import { Journal, JournalDocument } from '../models/schemas/journal.schema';
import { Mood, MoodDocument } from '../models/schemas/mood.schema';
import { Goal, GoalDocument } from '../models/schemas/goal.schema';
import { Article, ArticleDocument } from '../models/schemas/article.schema';
import { Audio, AudioDocument } from '../models/schemas/audio.schema';
import { ForumPost, ForumPostDocument } from '../models/schemas/forum-post.schema';
import { ForumComment, ForumCommentDocument } from '../models/schemas/forum-comment.schema';
import { ForumLike, ForumLikeDocument } from '../models/schemas/forum-like.schema';
import { Quote, QuoteDocument } from '../models/schemas/quote.schema';
import { NotificationTemplate, NotificationTemplateDocument } from '../models/schemas/notification-template.schema';
import { Internship, InternshipDocument } from '../models/schemas/internship.schema';
import { SessionStatus } from '../models/schemas/session.schema';
import { UserNotification, UserNotificationDocument } from '../models/schemas/user-notification.schema';
import { Steps, StepsDocument } from '../models/schemas/steps.schema';
import { UserAchievement, UserAchievementDocument } from '../models/schemas/user-achievement.schema';
import { Achievement, AchievementDocument } from '../models/schemas/achievement.schema';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Demographics.name) private demographicsModel: Model<DemographicsDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(SessionRequest.name) private sessionRequestModel: Model<SessionRequestDocument>,
    @InjectModel(SpecialistProfile.name) private specialistProfileModel: Model<SpecialistProfileDocument>,
    @InjectModel(Journal.name) private journalModel: Model<JournalDocument>,
    @InjectModel(Mood.name) private moodModel: Model<MoodDocument>,
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    @InjectModel(Article.name) private articleModel: Model<ArticleDocument>,
    @InjectModel(Audio.name) private audioModel: Model<AudioDocument>,
    @InjectModel(ForumPost.name) private forumPostModel: Model<ForumPostDocument>,
    @InjectModel(ForumComment.name) private forumCommentModel: Model<ForumCommentDocument>,
    @InjectModel(ForumLike.name) private forumLikeModel: Model<ForumLikeDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(NotificationTemplate.name) private notificationTemplateModel: Model<NotificationTemplateDocument>,
    @InjectModel(Internship.name) private internshipModel: Model<InternshipDocument>,
    @InjectModel(UserNotification.name) private userNotificationModel: Model<UserNotificationDocument>,
    @InjectModel(Steps.name) private stepsModel: Model<StepsDocument>,
    @InjectModel(UserAchievement.name) private userAchievementModel: Model<UserAchievementDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
  ) {}

  async getDashboardStats(startDate?: string, endDate?: string): Promise<any> {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));
    
    // Use provided dates or defaults
    const end = endDate ? new Date(endDate) : today;
    end.setHours(23, 59, 59, 999);
    
    const start = startDate ? new Date(startDate) : new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User Statistics
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      verifiedUsers,
      usersWithDemographics,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userTypeDistribution,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ is_disabled: false }).exec(),
      this.userModel.countDocuments({ is_disabled: true }).exec(),
      this.userModel.countDocuments({ is_email_verified: true }).exec(),
      this.demographicsModel.distinct('user_id').exec(),
      this.userModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.userModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.userModel.countDocuments({ createdAt: { $gte: monthAgo } }).exec(),
      this.userModel.aggregate([
        ...(startDate && endDate ? [{ $match: { createdAt: { $gte: start, $lte: end } } }] : []),
        { $group: { _id: '$user_type', count: { $sum: 1 } } },
      ]).exec(),
    ]);

    // Session Statistics
    const [
      totalSessions,
      sessionsThisWeek,
      sessionsThisMonth,
      confirmedSessions,
      completedSessions,
      cancelledSessions,
      upcomingSessions,
      sessionStatusBreakdown,
    ] = await Promise.all([
      this.sessionModel.countDocuments().exec(),
      this.sessionModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.sessionModel.countDocuments({ createdAt: { $gte: monthAgo } }).exec(),
      this.sessionModel.countDocuments({ status: SessionStatus.CONFIRMED }).exec(),
      this.sessionModel.countDocuments({ status: SessionStatus.COMPLETED }).exec(),
      this.sessionModel.countDocuments({ status: SessionStatus.CANCELLED }).exec(),
      this.sessionModel.countDocuments({
        status: SessionStatus.CONFIRMED,
        date: { $gte: new Date().toISOString().split('T')[0] },
      }).exec(),
      this.sessionModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).exec(),
    ]);

    // Specialist Statistics
    const [
      totalSpecialists,
      verifiedSpecialists,
      completedProfiles,
      avgRating,
      totalReviews,
    ] = await Promise.all([
      this.specialistProfileModel.countDocuments().exec(),
      this.specialistProfileModel.countDocuments({ is_verified: true }).exec(),
      this.specialistProfileModel.countDocuments({ profile_completed: true }).exec(),
      this.specialistProfileModel.aggregate([
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]).exec(),
      this.specialistProfileModel.aggregate([
        { $group: { _id: null, total: { $sum: '$total_reviews' } } },
      ]).exec(),
    ]);

    // Wellness Tracking Statistics
    const [
      totalMoodEntries,
      moodEntriesToday,
      moodEntriesThisWeek,
      totalJournalEntries,
      journalEntriesToday,
      journalEntriesThisWeek,
      activeGoals,
      completedGoals,
      totalGoals,
    ] = await Promise.all([
      this.moodModel.countDocuments().exec(),
      this.moodModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.moodModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.journalModel.countDocuments().exec(),
      this.journalModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.journalModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.goalModel.countDocuments({ status: 'in_progress' }).exec(),
      this.goalModel.countDocuments({ status: 'completed' }).exec(),
      this.goalModel.countDocuments().exec(),
    ]);

    // Content Statistics
    const [
      totalArticles,
      publishedArticles,
      totalArticleViews,
      totalAudios,
      activeAudios,
      totalAudioPlays,
      totalQuotes,
      todayQuotes,
      totalTemplates,
      activeTemplates,
    ] = await Promise.all([
      this.articleModel.countDocuments().exec(),
      this.articleModel.countDocuments({ status: 'published' }).exec(),
      this.articleModel.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } },
      ]).exec(),
      this.audioModel.countDocuments().exec(),
      this.audioModel.countDocuments({ is_active: true }).exec(),
      this.audioModel.aggregate([
        { $group: { _id: null, total: { $sum: '$play_count' } } },
      ]).exec(),
      this.quoteModel.countDocuments().exec(),
      this.quoteModel.countDocuments({ is_today_quote: true }).exec(),
      this.notificationTemplateModel.countDocuments().exec(),
      this.notificationTemplateModel.countDocuments({ is_active: true }).exec(),
    ]);

    // Forum Statistics
    const [
      totalForumPosts,
      forumPostsToday,
      forumPostsThisWeek,
      totalForumComments,
      forumCommentsToday,
      totalForumLikes,
      forumActiveUsers,
    ] = await Promise.all([
      this.forumPostModel.countDocuments().exec(),
      this.forumPostModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.forumPostModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.forumCommentModel.countDocuments().exec(),
      this.forumCommentModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.forumLikeModel.countDocuments().exec(),
      this.forumPostModel.distinct('user_id').exec(),
    ]);

    // Internship Statistics
    const [
      totalInternships,
      activeInternships,
      uniqueMentors,
      uniqueCities,
    ] = await Promise.all([
      this.internshipModel.countDocuments().exec(),
      this.internshipModel.countDocuments({ is_active: { $ne: false } }).exec(),
      this.internshipModel.distinct('mentorName').exec(),
      this.internshipModel.distinct('city').exec(),
    ]);

    // Notification Statistics
    const [
      totalNotifications,
      notificationsToday,
      notificationsThisWeek,
      unreadNotifications,
      readNotifications,
    ] = await Promise.all([
      this.userNotificationModel.countDocuments().exec(),
      this.userNotificationModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.userNotificationModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.userNotificationModel.countDocuments({ status: 'unread' }).exec(),
      this.userNotificationModel.countDocuments({ status: 'read' }).exec(),
    ]);

    // Steps & Activity Statistics
    const [
      totalStepsEntries,
      stepsEntriesToday,
      stepsEntriesThisWeek,
      totalSteps,
      totalCaloriesBurned,
    ] = await Promise.all([
      this.stepsModel.countDocuments().exec(),
      this.stepsModel.countDocuments({ createdAt: { $gte: today } }).exec(),
      this.stepsModel.countDocuments({ createdAt: { $gte: weekAgo } }).exec(),
      this.stepsModel.aggregate([
        { $group: { _id: null, total: { $sum: '$steps' } } },
      ]).exec(),
      this.stepsModel.aggregate([
        { $group: { _id: null, total: { $sum: '$calories_burned' } } },
      ]).exec(),
    ]);

    // Achievement Statistics
    const [
      totalAchievements,
      unlockedAchievements,
      totalUserAchievements,
      achievementsToday,
    ] = await Promise.all([
      this.achievementModel.countDocuments().exec(),
      this.userAchievementModel.countDocuments({ status: 'unlocked' }).exec(),
      this.userAchievementModel.countDocuments().exec(),
      this.userAchievementModel.countDocuments({
        unlocked_at: { $gte: today },
        status: 'unlocked',
      }).exec(),
    ]);

    // Session Request Statistics
    const [
      totalSessionRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      requestsToday,
    ] = await Promise.all([
      this.sessionRequestModel.countDocuments().exec(),
      this.sessionRequestModel.countDocuments({ status: 'pending' }).exec(),
      this.sessionRequestModel.countDocuments({ status: 'approved' }).exec(),
      this.sessionRequestModel.countDocuments({ status: 'rejected' }).exec(),
      this.sessionRequestModel.countDocuments({ createdAt: { $gte: today } }).exec(),
    ]);

    // Revenue Statistics
    const [
      totalRevenue,
      revenueThisWeek,
      revenueThisMonth,
      revenueToday,
      avgSessionPrice,
      revenueBySpecialist,
    ] = await Promise.all([
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).exec(),
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED, createdAt: { $gte: weekAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).exec(),
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED, createdAt: { $gte: monthAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).exec(),
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED, createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).exec(),
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED } },
        { $group: { _id: null, avg: { $avg: '$amount' } } },
      ]).exec(),
      this.sessionModel.aggregate([
        { $match: { status: SessionStatus.COMPLETED } },
        { $group: { _id: '$doctor_id', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctor' } },
        { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      ]).exec(),
    ]);

    // Pending Payments
    const pendingPayments = await this.sessionRequestModel.aggregate([
      { $match: { status: 'pending_payment' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).exec();

    // Top Performers - Users
    const topUsers = await this.forumPostModel.aggregate([
      { $group: { _id: '$user_id', postCount: { $sum: 1 } } },
      { $sort: { postCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]).exec();

    const topCommenters = await this.forumCommentModel.aggregate([
      { $group: { _id: '$user_id', commentCount: { $sum: 1 } } },
      { $sort: { commentCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]).exec();

    // Top Content
    const topArticles = await this.articleModel.find({ status: 'published' })
      .sort({ views: -1 })
      .limit(10)
      .select('title views status createdAt')
      .exec();

    const topAudios = await this.audioModel.find({ is_active: true })
      .sort({ play_count: -1 })
      .limit(10)
      .select('title play_count is_active createdAt')
      .exec();

    const topForumPosts = await this.forumPostModel.aggregate([
      { $lookup: { from: 'forum_likes', localField: '_id', foreignField: 'post_id', as: 'likes' } },
      { $addFields: { likeCount: { $size: '$likes' } } },
      { $sort: { likeCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]).exec();

    // Recent Activity
    const recentUsers = await this.userModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('first_name last_name email username user_type createdAt')
      .exec();

    const recentSessions = await this.sessionModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user_id', 'first_name last_name username')
      .populate('doctor_id', 'first_name last_name username')
      .select('date start_time status amount createdAt')
      .exec();

    const recentPosts = await this.forumPostModel.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user_id', 'first_name last_name username')
      .select('title category likes_count comments_count createdAt')
      .exec();

    const recentAchievements = await this.userAchievementModel.find({ status: 'unlocked' })
      .sort({ unlocked_at: -1 })
      .limit(10)
      .populate('user_id', 'first_name last_name username')
      .populate('achievement_id', 'name icon description')
      .select('unlocked_at')
      .exec();

    // User Retention Metrics - Calculate manually for better control
    const allUsers = await this.userModel.find().select('createdAt updatedAt is_disabled').exec();
    const retentionBuckets = [
      { range: '0-7', min: 0, max: 7 },
      { range: '8-30', min: 8, max: 30 },
      { range: '31-90', min: 31, max: 90 },
      { range: '91-180', min: 91, max: 180 },
      { range: '181-365', min: 181, max: 365 },
      { range: '365+', min: 365, max: Infinity },
    ];

    const retentionData = retentionBuckets.map(bucket => {
      const usersInRange = allUsers.filter((user: any) => {
        const createdAt = user.createdAt || (user as any).created_at;
        const daysSinceCreated = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreated >= bucket.min && daysSinceCreated < bucket.max;
      });

      const activeUsers = usersInRange.filter((user: any) => {
        const updatedAt = user.updatedAt || (user as any).updated_at;
        const daysSinceUpdated = (new Date().getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdated <= 7 && !user.is_disabled;
      });

      return {
        age_range: bucket.range,
        total_users: usersInRange.length,
        active_users: activeUsers.length,
        retention_rate: usersInRange.length > 0 ? Math.round((activeUsers.length / usersInRange.length) * 100) : 0,
      };
    });

    // Calculate active users (last 7 and 30 days)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const activeUsers7d = await this.userModel.countDocuments({
      updatedAt: { $gte: sevenDaysAgo },
      is_disabled: false,
    }).exec();
    
    const activeUsers30d = await this.userModel.countDocuments({
      updatedAt: { $gte: thirtyDaysAgo },
      is_disabled: false,
    }).exec();

    // User growth trend (last 7 days)
    const userGrowthTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const count = await this.userModel.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      }).exec();
      userGrowthTrend.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    // Activity trends (last 7 days)
    const activityTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const [moods, journals, posts, comments] = await Promise.all([
        this.moodModel.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }).exec(),
        this.journalModel.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }).exec(),
        this.forumPostModel.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }).exec(),
        this.forumCommentModel.countDocuments({ createdAt: { $gte: date, $lt: nextDate } }).exec(),
      ]);
      activityTrend.push({
        date: date.toISOString().split('T')[0],
        moods,
        journals,
        posts,
        comments,
      });
    }

    // Mood distribution
    const moodDistribution = await this.moodModel.aggregate([
      { $group: { _id: '$mood', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    // Goal category breakdown
    const goalCategoryBreakdown = await this.goalModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec();

    // Session completion rate
    const sessionCompletionRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

    // Goal completion rate
    const goalCompletionRate = totalGoals > 0
      ? Math.round((completedGoals / totalGoals) * 100)
      : 0;

    // Email verification rate
    const emailVerificationRate = totalUsers > 0
      ? Math.round((verifiedUsers / totalUsers) * 100)
      : 0;

    // Demographics completion rate
    const demographicsCompletionRate = totalUsers > 0
      ? Math.round((usersWithDemographics.length / totalUsers) * 100)
      : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        disabled: disabledUsers,
        verified: verifiedUsers,
        with_demographics: usersWithDemographics.length,
        new_today: newUsersToday,
        new_this_week: newUsersThisWeek,
        new_this_month: newUsersThisMonth,
        active_7d: activeUsers7d,
        active_30d: activeUsers30d,
        type_distribution: userTypeDistribution.map((item: any) => ({
          type: item._id || 'user',
          count: item.count,
        })),
        email_verification_rate: emailVerificationRate,
        demographics_completion_rate: demographicsCompletionRate,
        growth_trend: userGrowthTrend,
      },
      sessions: {
        total: totalSessions,
        this_week: sessionsThisWeek,
        this_month: sessionsThisMonth,
        confirmed: confirmedSessions,
        completed: completedSessions,
        cancelled: cancelledSessions,
        upcoming: upcomingSessions,
        completion_rate: sessionCompletionRate,
        status_breakdown: sessionStatusBreakdown.map((item: any) => ({
          status: item._id,
          count: item.count,
        })),
      },
      specialists: {
        total: totalSpecialists,
        verified: verifiedSpecialists,
        completed_profiles: completedProfiles,
        avg_rating: avgRating[0]?.avg || 0,
        total_reviews: totalReviews[0]?.total || 0,
      },
      wellness: {
        mood: {
          total_entries: totalMoodEntries,
          entries_today: moodEntriesToday,
          entries_this_week: moodEntriesThisWeek,
          distribution: moodDistribution.map((item: any) => ({
            mood: item._id || 'neutral',
            count: item.count,
          })),
        },
        journal: {
          total_entries: totalJournalEntries,
          entries_today: journalEntriesToday,
          entries_this_week: journalEntriesThisWeek,
        },
        goals: {
          total: totalGoals,
          active: activeGoals,
          completed: completedGoals,
          completion_rate: goalCompletionRate,
          category_breakdown: goalCategoryBreakdown.map((item: any) => ({
            category: item._id,
            count: item.count,
          })),
        },
      },
      content: {
        articles: {
          total: totalArticles,
          published: publishedArticles,
          total_views: totalArticleViews[0]?.total || 0,
        },
        audio: {
          total: totalAudios,
          active: activeAudios,
          total_plays: totalAudioPlays[0]?.total || 0,
        },
        quotes: {
          total: totalQuotes,
          today: todayQuotes,
        },
        templates: {
          total: totalTemplates,
          active: activeTemplates,
        },
      },
      forum: {
        total_posts: totalForumPosts,
        posts_today: forumPostsToday,
        posts_this_week: forumPostsThisWeek,
        total_comments: totalForumComments,
        comments_today: forumCommentsToday,
        total_likes: totalForumLikes,
        active_users: forumActiveUsers.length,
      },
      activity_trend: activityTrend,
      internships: {
        total: totalInternships,
        active: activeInternships,
        mentors: uniqueMentors.length,
        cities: uniqueCities.length,
      },
      notifications: {
        total: totalNotifications,
        today: notificationsToday,
        this_week: notificationsThisWeek,
        unread: unreadNotifications,
        read: readNotifications,
        read_rate: totalNotifications > 0 ? Math.round((readNotifications / totalNotifications) * 100) : 0,
      },
      activity: {
        steps: {
          total_entries: totalStepsEntries,
          entries_today: stepsEntriesToday,
          entries_this_week: stepsEntriesThisWeek,
          total_steps: totalSteps[0]?.total || 0,
          total_calories: totalCaloriesBurned[0]?.total || 0,
        },
      },
      achievements: {
        total_achievements: totalAchievements,
        unlocked: unlockedAchievements,
        total_user_achievements: totalUserAchievements,
        unlocked_today: achievementsToday,
        unlock_rate: totalUserAchievements > 0 ? Math.round((unlockedAchievements / totalUserAchievements) * 100) : 0,
      },
      session_requests: {
        total: totalSessionRequests,
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        today: requestsToday,
        approval_rate: totalSessionRequests > 0 ? Math.round((approvedRequests / totalSessionRequests) * 100) : 0,
      },
      revenue: {
        total: totalRevenue[0]?.total || 0,
        this_week: revenueThisWeek[0]?.total || 0,
        this_month: revenueThisMonth[0]?.total || 0,
        today: revenueToday[0]?.total || 0,
        avg_session_price: avgSessionPrice[0]?.avg || 0,
        pending_payments: pendingPayments[0]?.total || 0,
        pending_payments_count: pendingPayments[0]?.count || 0,
        top_specialists: revenueBySpecialist.map((item: any) => ({
          doctor_id: item._id?.toString(),
          doctor_name: item.doctor ? `${item.doctor.first_name || ''} ${item.doctor.last_name || ''}`.trim() : 'Unknown',
          revenue: item.total,
          sessions: item.count,
        })),
      },
      top_performers: {
        users: {
          top_posters: topUsers.map((item: any) => ({
            user_id: item._id?.toString(),
            name: item.user ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() : 'Unknown',
            username: item.user?.username || 'N/A',
            posts: item.postCount,
          })),
          top_commenters: topCommenters.map((item: any) => ({
            user_id: item._id?.toString(),
            name: item.user ? `${item.user.first_name || ''} ${item.user.last_name || ''}`.trim() : 'Unknown',
            username: item.user?.username || 'N/A',
            comments: item.commentCount,
          })),
        },
        content: {
          top_articles: topArticles.map((article: any) => ({
            id: article._id.toString(),
            title: article.title,
            views: article.views || 0,
            created_at: article.createdAt,
          })),
          top_audios: topAudios.map((audio: any) => ({
            id: audio._id.toString(),
            title: audio.title,
            plays: audio.play_count || 0,
            created_at: audio.createdAt,
          })),
          top_posts: topForumPosts.map((post: any) => ({
            id: post._id.toString(),
            title: post.title,
            category: post.category,
            likes: post.likeCount || 0,
            author: post.user ? `${post.user.first_name || ''} ${post.user.last_name || ''}`.trim() : 'Unknown',
            created_at: post.createdAt,
          })),
        },
      },
      recent_activity: {
        new_users: recentUsers.map((user: any) => ({
          id: user._id.toString(),
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown',
          username: user.username,
          email: user.email,
          type: user.user_type,
          created_at: user.createdAt,
        })),
        sessions: recentSessions.map((session: any) => ({
          id: session._id.toString(),
          date: session.date,
          time: session.start_time,
          status: session.status,
          amount: session.amount,
          user: session.user_id ? {
            name: `${session.user_id.first_name || ''} ${session.user_id.last_name || ''}`.trim(),
            username: session.user_id.username,
          } : null,
          doctor: session.doctor_id ? {
            name: `${session.doctor_id.first_name || ''} ${session.doctor_id.last_name || ''}`.trim(),
            username: session.doctor_id.username,
          } : null,
          created_at: session.createdAt,
        })),
        forum_posts: recentPosts.map((post: any) => ({
          id: post._id.toString(),
          title: post.title,
          category: post.category,
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          author: post.user_id ? {
            name: `${post.user_id.first_name || ''} ${post.user_id.last_name || ''}`.trim(),
            username: post.user_id.username,
          } : null,
          created_at: post.createdAt,
        })),
        achievements: recentAchievements
          .filter((ach: any) => ach.achievement_id && ach.user_id)
          .map((ach: any) => ({
            id: ach._id.toString(),
            achievement_name: ach.achievement_id?.name || 'Unknown',
            achievement_icon: ach.achievement_id?.icon || '',
            achievement_description: ach.achievement_id?.description || '',
            user: ach.user_id ? {
              name: `${ach.user_id.first_name || ''} ${ach.user_id.last_name || ''}`.trim(),
              username: ach.user_id.username,
            } : null,
            unlocked_at: ach.unlocked_at,
          })),
      },
      retention: {
        user_retention_by_age: retentionData.map((bucket: any) => ({
          age_range: bucket._id === '365+' ? '365+' : `${bucket._id}-${bucket._id === 0 ? 6 : bucket._id === 7 ? 29 : bucket._id === 30 ? 89 : bucket._id === 90 ? 179 : bucket._id === 180 ? 364 : '365+'}`,
          total_users: bucket.count,
          active_users: bucket.active,
          retention_rate: bucket.count > 0 ? Math.round((bucket.active / bucket.count) * 100) : 0,
        })),
        dau: activeUsers7d,
        wau: activeUsers7d,
        mau: activeUsers30d,
        retention_rate: totalUsers > 0 ? Math.round((activeUsers30d / totalUsers) * 100) : 0,
      },
    };
  }

  async getUserInsights(userId: string): Promise<any> {
    const userObjectId = new Types.ObjectId(userId);

    // Get user basic info
    const user = await this.userModel.findById(userId).select('-password -otp_token').lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get last mood entry
    const lastMood = await this.moodModel
      .findOne({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .lean();

    // Get last journal entry
    const lastJournal = await this.journalModel
      .findOne({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .lean();

    // Get last steps entry
    const lastSteps = await this.stepsModel
      .findOne({ user_id: userObjectId })
      .sort({ date: -1 })
      .lean();

    // Get goals summary
    const [activeGoals, completedGoals, totalGoals] = await Promise.all([
      this.goalModel.countDocuments({ user_id: userObjectId, status: 'in_progress' }).exec(),
      this.goalModel.countDocuments({ user_id: userObjectId, status: 'completed' }).exec(),
      this.goalModel.countDocuments({ user_id: userObjectId }).exec(),
    ]);

    const recentGoals = await this.goalModel
      .find({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get forum stats
    const [totalPosts, totalComments, totalLikes] = await Promise.all([
      this.forumPostModel.countDocuments({ user_id: userObjectId }).exec(),
      this.forumCommentModel.countDocuments({ user_id: userObjectId }).exec(),
      this.forumLikeModel.countDocuments({ user_id: userObjectId }).exec(),
    ]);

    const lastPost = await this.forumPostModel
      .findOne({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .select('title category createdAt')
      .lean();

    const lastComment = await this.forumCommentModel
      .findOne({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .select('content post_id createdAt')
      .lean();

    // Get session stats
    const [totalSessions, completedSessions, upcomingSessions] = await Promise.all([
      this.sessionModel.countDocuments({ user_id: userObjectId }).exec(),
      this.sessionModel.countDocuments({ user_id: userObjectId, status: SessionStatus.COMPLETED }).exec(),
      this.sessionModel.countDocuments({ 
        user_id: userObjectId, 
        status: SessionStatus.CONFIRMED,
        date: { $gte: new Date().toISOString().split('T')[0] },
      }).exec(),
    ]);

    const lastSession = await this.sessionModel
      .findOne({ user_id: userObjectId })
      .sort({ createdAt: -1 })
      .select('date start_time status amount createdAt')
      .lean();

    // Get achievements
    const [totalAchievements, unlockedAchievements] = await Promise.all([
      this.userAchievementModel.countDocuments({ user_id: userObjectId }).exec(),
      this.userAchievementModel.countDocuments({ user_id: userObjectId, status: 'unlocked' }).exec(),
    ]);

    const recentAchievements = await this.userAchievementModel
      .find({ user_id: userObjectId, status: 'unlocked' })
      .sort({ unlocked_at: -1 })
      .limit(5)
      .populate('achievement_id', 'name icon description')
      .lean();

    // Get demographics
    const demographics = await this.demographicsModel
      .findOne({ user_id: userObjectId })
      .lean();

    // Calculate activity streak (days with any activity)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentActivities = await Promise.all([
      this.moodModel.countDocuments({ user_id: userObjectId, createdAt: { $gte: sevenDaysAgo } }).exec(),
      this.journalModel.countDocuments({ user_id: userObjectId, createdAt: { $gte: sevenDaysAgo } }).exec(),
      this.stepsModel.countDocuments({ user_id: userObjectId, date: { $gte: sevenDaysAgo } }).exec(),
      this.forumPostModel.countDocuments({ user_id: userObjectId, createdAt: { $gte: sevenDaysAgo } }).exec(),
      this.forumCommentModel.countDocuments({ user_id: userObjectId, createdAt: { $gte: sevenDaysAgo } }).exec(),
    ]);

    const totalRecentActivity = recentActivities.reduce((sum, count) => sum + count, 0);

    // Calculate days since last activity
    const lastActivityDate = [
      (lastMood as any)?.createdAt,
      (lastJournal as any)?.createdAt,
      lastSteps?.date,
      (lastPost as any)?.createdAt,
      (lastComment as any)?.createdAt,
    ]
      .filter(Boolean)
      .map(date => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const daysSinceLastActivity = lastActivityDate
      ? Math.floor((new Date().getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      user: {
        _id: (user as any)._id.toString(),
        first_name: (user as any).first_name,
        last_name: (user as any).last_name,
        email: (user as any).email,
        username: (user as any).username,
        user_type: (user as any).user_type,
        is_email_verified: (user as any).is_email_verified,
        is_disabled: (user as any).is_disabled,
        createdAt: (user as any).createdAt,
        updatedAt: (user as any).updatedAt,
      },
      wellness: {
        last_mood: lastMood ? {
          mood: (lastMood as any).mood,
          date: (lastMood as any).createdAt,
          days_ago: Math.floor((new Date().getTime() - new Date((lastMood as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        last_journal: lastJournal ? {
          date: (lastJournal as any).createdAt,
          days_ago: Math.floor((new Date().getTime() - new Date((lastJournal as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        last_steps: lastSteps ? {
          steps: (lastSteps as any).steps,
          calories: (lastSteps as any).calories_burned || 0,
          date: (lastSteps as any).date,
          days_ago: Math.floor((new Date().getTime() - new Date((lastSteps as any).date).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        goals: {
          active: activeGoals,
          completed: completedGoals,
          total: totalGoals,
          completion_rate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
          recent: recentGoals.map((goal: any) => ({
            id: goal._id.toString(),
            title: goal.title,
            category: goal.category,
            status: goal.status,
            created_at: goal.createdAt,
          })),
        },
      },
      forum: {
        total_posts: totalPosts,
        total_comments: totalComments,
        total_likes: totalLikes,
        last_post: lastPost ? {
          title: (lastPost as any).title,
          category: (lastPost as any).category,
          date: (lastPost as any).createdAt,
          days_ago: Math.floor((new Date().getTime() - new Date((lastPost as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
        last_comment: lastComment ? {
          content: (lastComment as any).content,
          date: (lastComment as any).createdAt,
          days_ago: Math.floor((new Date().getTime() - new Date((lastComment as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
      },
      sessions: {
        total: totalSessions,
        completed: completedSessions,
        upcoming: upcomingSessions,
        last_session: lastSession ? {
          date: (lastSession as any).date,
          time: (lastSession as any).start_time,
          status: (lastSession as any).status,
          amount: (lastSession as any).amount,
          created_at: (lastSession as any).createdAt,
          days_ago: Math.floor((new Date().getTime() - new Date((lastSession as any).createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        } : null,
      },
      achievements: {
        total: totalAchievements,
        unlocked: unlockedAchievements,
        recent: recentAchievements
          .filter((ach: any) => ach.achievement_id)
          .map((ach: any) => ({
            id: ach._id.toString(),
            name: ach.achievement_id.name,
            icon: ach.achievement_id.icon,
            description: ach.achievement_id.description,
            unlocked_at: ach.unlocked_at,
            days_ago: ach.unlocked_at
              ? Math.floor((new Date().getTime() - new Date(ach.unlocked_at).getTime()) / (1000 * 60 * 60 * 24))
              : null,
          })),
      },
      demographics: demographics ? {
        has_demographics: true,
        age: (demographics as any).age,
        gender: (demographics as any).gender,
        city: (demographics as any).city,
      } : { has_demographics: false },
      activity: {
        days_since_last_activity: daysSinceLastActivity,
        recent_activity_count: totalRecentActivity,
        activity_streak: totalRecentActivity > 0 ? 'Active' : 'Inactive',
      },
    };
  }
}

