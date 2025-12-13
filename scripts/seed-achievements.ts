import * as mongoose from 'mongoose';
import { Achievement, AchievementSchema, AchievementCategory, AchievementConditionType } from '../src/models/schemas/achievement.schema';

async function seedAchievements() {
  try {
    // Connect to MongoDB
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || 27017;
    const db = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'fikrless';
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;

    let uri = `mongodb://${host}:${port}/${db}`;

    if (username && password) {
      uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=admin`;
    }

    console.log(`Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Create Achievement model
    let AchievementModel;
    try {
      AchievementModel = mongoose.model('Achievement');
    } catch {
      AchievementModel = mongoose.model('Achievement', AchievementSchema);
    }

    // Clear existing achievements (optional - comment out if you want to keep existing)
    // await AchievementModel.deleteMany({}).exec();
    // console.log('🧹 Cleared existing achievements\n');

    // Define achievements to seed
    const achievements = [
      {
        name: 'Week Warrior',
        description: '7 days in a row',
        icon: 'star',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 7,
        xp_reward: 100,
        is_active: true,
        order: 1,
      },
      {
        name: 'Community Helper',
        description: 'Helped 5 people in forums',
        icon: 'handshake',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 5,
        xp_reward: 50,
        is_active: true,
        order: 2,
      },
      {
        name: 'First Steps',
        description: 'Complete your first 10,000 steps',
        icon: 'foot',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 10000,
        xp_reward: 25,
        is_active: true,
        order: 3,
      },
      {
        name: 'Mood Tracker',
        description: 'Track mood for 30 days',
        icon: 'smile',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 30,
        xp_reward: 75,
        is_active: true,
        order: 4,
      },
      {
        name: 'Journal Keeper',
        description: 'Write in journal for 14 days',
        icon: 'notebook',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 14,
        xp_reward: 50,
        is_active: true,
        order: 5,
      },
      {
        name: 'Month Warrior',
        description: '30 days in a row',
        icon: 'trophy',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 30,
        xp_reward: 200,
        is_active: true,
        order: 6,
      },
      {
        name: 'Super Helper',
        description: 'Helped 20 people in forums',
        icon: 'heart',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 20,
        xp_reward: 150,
        is_active: true,
        order: 7,
      },
      {
        name: 'Step Master',
        description: 'Complete 50,000 total steps',
        icon: 'medal',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 50000,
        xp_reward: 100,
        is_active: true,
        order: 8,
      },
      {
        name: 'Mood Master',
        description: 'Track mood for 90 days',
        icon: 'star',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 90,
        xp_reward: 150,
        is_active: true,
        order: 9,
      },
      {
        name: 'Dedicated Writer',
        description: 'Write in journal for 30 days',
        icon: 'book',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 30,
        xp_reward: 100,
        is_active: true,
        order: 10,
      },
      // ============================================
      // NEW ACHIEVEMENTS - STREAK CATEGORY
      // ============================================
      {
        name: 'Getting Started',
        description: '3 days in a row',
        icon: 'seedling',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 3,
        xp_reward: 25,
        is_active: true,
        order: 11,
      },
      {
        name: 'Two Week Champion',
        description: '14 days in a row',
        icon: 'calendar',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 14,
        xp_reward: 150,
        is_active: true,
        order: 12,
      },
      {
        name: 'Quarter Warrior',
        description: '60 days in a row',
        icon: 'shield',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 60,
        xp_reward: 300,
        is_active: true,
        order: 13,
      },
      {
        name: 'Century Club',
        description: '100 days in a row',
        icon: 'crown',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 100,
        xp_reward: 500,
        is_active: true,
        order: 14,
      },
      {
        name: 'Year Warrior',
        description: '365 days in a row',
        icon: 'trophy',
        category: AchievementCategory.STREAK,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 365,
        xp_reward: 1000,
        is_active: true,
        order: 15,
      },
      // ============================================
      // NEW ACHIEVEMENTS - COMMUNITY CATEGORY
      // ============================================
      {
        name: 'First Help',
        description: 'Helped 1 person in forums',
        icon: 'heart',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 1,
        xp_reward: 10,
        is_active: true,
        order: 16,
      },
      {
        name: 'Supportive Friend',
        description: 'Helped 10 people in forums',
        icon: 'users',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 10,
        xp_reward: 75,
        is_active: true,
        order: 17,
      },
      {
        name: 'Community Champion',
        description: 'Helped 50 people in forums',
        icon: 'award',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 50,
        xp_reward: 300,
        is_active: true,
        order: 18,
      },
      {
        name: 'Community Hero',
        description: 'Helped 100 people in forums',
        icon: 'star',
        category: AchievementCategory.COMMUNITY,
        condition_type: AchievementConditionType.FORUM_HELPS,
        condition_value: 100,
        xp_reward: 500,
        is_active: true,
        order: 19,
      },
      // ============================================
      // NEW ACHIEVEMENTS - ACTIVITY CATEGORY (STEPS)
      // ============================================
      {
        name: 'Daily Walker',
        description: 'Complete 5,000 steps in a day',
        icon: 'walking',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 5000,
        xp_reward: 15,
        is_active: true,
        order: 20,
      },
      {
        name: 'Active Explorer',
        description: 'Complete 25,000 total steps',
        icon: 'compass',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 25000,
        xp_reward: 50,
        is_active: true,
        order: 21,
      },
      {
        name: 'Marathon Walker',
        description: 'Complete 100,000 total steps',
        icon: 'route',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 100000,
        xp_reward: 200,
        is_active: true,
        order: 22,
      },
      {
        name: 'Ultra Walker',
        description: 'Complete 500,000 total steps',
        icon: 'mountain',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 500000,
        xp_reward: 500,
        is_active: true,
        order: 23,
      },
      {
        name: 'Million Steps',
        description: 'Complete 1,000,000 total steps',
        icon: 'trophy',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.STEPS_TOTAL,
        condition_value: 1000000,
        xp_reward: 1000,
        is_active: true,
        order: 24,
      },
      // ============================================
      // NEW ACHIEVEMENTS - ACTIVITY CATEGORY (MOOD)
      // ============================================
      {
        name: 'Mood Beginner',
        description: 'Track mood for 7 days',
        icon: 'smile',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 7,
        xp_reward: 20,
        is_active: true,
        order: 25,
      },
      {
        name: 'Mood Explorer',
        description: 'Track mood for 14 days',
        icon: 'sun',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 14,
        xp_reward: 40,
        is_active: true,
        order: 26,
      },
      {
        name: 'Mood Expert',
        description: 'Track mood for 60 days',
        icon: 'rainbow',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 60,
        xp_reward: 100,
        is_active: true,
        order: 27,
      },
      {
        name: 'Mood Legend',
        description: 'Track mood for 180 days',
        icon: 'star',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 180,
        xp_reward: 300,
        is_active: true,
        order: 28,
      },
      {
        name: 'Mood Master Pro',
        description: 'Track mood for 365 days',
        icon: 'crown',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.MOOD_DAYS,
        condition_value: 365,
        xp_reward: 500,
        is_active: true,
        order: 29,
      },
      // ============================================
      // NEW ACHIEVEMENTS - ACTIVITY CATEGORY (JOURNAL)
      // ============================================
      {
        name: 'First Entry',
        description: 'Write in journal for 1 day',
        icon: 'pen',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 1,
        xp_reward: 5,
        is_active: true,
        order: 30,
      },
      {
        name: 'Weekly Writer',
        description: 'Write in journal for 7 days',
        icon: 'book-open',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 7,
        xp_reward: 30,
        is_active: true,
        order: 31,
      },
      {
        name: 'Consistent Writer',
        description: 'Write in journal for 60 days',
        icon: 'feather',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 60,
        xp_reward: 150,
        is_active: true,
        order: 32,
      },
      {
        name: 'Writing Legend',
        description: 'Write in journal for 100 days',
        icon: 'scroll',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 100,
        xp_reward: 250,
        is_active: true,
        order: 33,
      },
      {
        name: 'Master Journalist',
        description: 'Write in journal for 365 days',
        icon: 'book',
        category: AchievementCategory.ACTIVITY,
        condition_type: AchievementConditionType.JOURNAL_DAYS,
        condition_value: 365,
        xp_reward: 500,
        is_active: true,
        order: 34,
      },
      // ============================================
      // NEW ACHIEVEMENTS - MILESTONE CATEGORY
      // ============================================
      {
        name: 'First Week',
        description: 'Complete your first week',
        icon: 'calendar-check',
        category: AchievementCategory.MILESTONE,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 7,
        xp_reward: 50,
        is_active: true,
        order: 35,
      },
      {
        name: 'First Month',
        description: 'Complete your first month',
        icon: 'calendar-star',
        category: AchievementCategory.MILESTONE,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 30,
        xp_reward: 100,
        is_active: true,
        order: 36,
      },
      {
        name: 'Hundred Days',
        description: 'Reach 100 days milestone',
        icon: 'medal',
        category: AchievementCategory.MILESTONE,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 100,
        xp_reward: 250,
        is_active: true,
        order: 37,
      },
      {
        name: 'One Year Strong',
        description: 'Complete a full year',
        icon: 'trophy',
        category: AchievementCategory.MILESTONE,
        condition_type: AchievementConditionType.STREAK_DAYS,
        condition_value: 365,
        xp_reward: 500,
        is_active: true,
        order: 38,
      },
    ];

    console.log(`📝 Seeding ${achievements.length} achievements...\n`);

    const results = [];
    for (const achievementData of achievements) {
      // Check if achievement already exists
      const existing = await AchievementModel.findOne({ name: achievementData.name }).exec();
      
      if (existing) {
        // Update existing achievement
        Object.assign(existing, achievementData);
        await existing.save();
        console.log(`✅ Updated: ${achievementData.name}`);
        results.push({ name: achievementData.name, status: 'updated' });
      } else {
        // Create new achievement
        const achievement = new AchievementModel(achievementData);
        await achievement.save();
        console.log(`✅ Created: ${achievementData.name}`);
        results.push({ name: achievementData.name, status: 'created' });
      }
    }

    console.log('\n==========================================');
    console.log('📊 Seed Summary');
    console.log('==========================================');
    console.log(`Total achievements: ${achievements.length}`);
    console.log(`Created: ${results.filter(r => r.status === 'created').length}`);
    console.log(`Updated: ${results.filter(r => r.status === 'updated').length}`);
    console.log('==========================================\n');

    // Close connection
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
    console.log('\n🎉 Achievement seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding achievements:', error);
    process.exit(1);
  }
}

// Run the seed
seedAchievements();

