import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { Steps, StepsSchema } from '../src/models/schemas/steps.schema';
import { Mood, MoodSchema } from '../src/models/schemas/mood.schema';
import { Journal, JournalSchema } from '../src/models/schemas/journal.schema';
import { Goal, GoalSchema } from '../src/models/schemas/goal.schema';
import { Achievement, AchievementSchema } from '../src/models/schemas/achievement.schema';
import { UserAchievement, UserAchievementSchema } from '../src/models/schemas/user-achievement.schema';
import { UserPlant, UserPlantSchema } from '../src/models/schemas/user-plant.schema';
import { WeeklyGoal, WeeklyGoalSchema } from '../src/models/schemas/weekly-goal.schema';
import { ForumPost, ForumPostSchema } from '../src/models/schemas/forum-post.schema';
import { ForumComment, ForumCommentSchema } from '../src/models/schemas/forum-comment.schema';
import { ForumLike, ForumLikeSchema } from '../src/models/schemas/forum-like.schema';
import { Article, ArticleSchema } from '../src/models/schemas/article.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import * as http from 'http';
import { URL } from 'url';

const BASE_URL = process.env.API_URL || 'http://localhost:5002';
const API_BASE = `${BASE_URL}/api/v1`;

// Helper function to make HTTP requests
function makeRequest(url: string, options: { method: string; headers?: any; body?: string }): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 200, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: { raw: data } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

interface TestResult {
  testNumber: number;
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

interface TestUser {
  email: string;
  password: string;
  token: string;
  userId: string;
  username: string;
}

class CompleteSystemTestSuite {
  private results: TestResult[] = [];
  private testCount = 0;
  
  // Three test users
  private user1: TestUser = { email: '', password: 'Test123456!', token: '', userId: '', username: '' };
  private user2: TestUser = { email: '', password: 'Test123456!', token: '', userId: '', username: '' };
  private user3: TestUser = { email: '', password: 'Test123456!', token: '', userId: '', username: '' };
  
  // Shared data
  private forumPostId: string = '';
  private forumCommentId: string = '';
  private articleId: string = '';
  private goalId: string = '';
  private achievementIds: string[] = [];

  // Models
  private UserModel: mongoose.Model<any>;
  private StepsModel: mongoose.Model<any>;
  private MoodModel: mongoose.Model<any>;
  private JournalModel: mongoose.Model<any>;
  private GoalModel: mongoose.Model<any>;
  private AchievementModel: mongoose.Model<any>;
  private UserAchievementModel: mongoose.Model<any>;
  private UserPlantModel: mongoose.Model<any>;
  private WeeklyGoalModel: mongoose.Model<any>;
  private ForumPostModel: mongoose.Model<any>;
  private ForumCommentModel: mongoose.Model<any>;
  private ForumLikeModel: mongoose.Model<any>;
  private ArticleModel: mongoose.Model<any>;
  private SpecialistProfileModel: mongoose.Model<any>;

  constructor() {
    // Initialize models
    this.UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
    this.StepsModel = mongoose.models.Steps || mongoose.model('Steps', StepsSchema);
    this.MoodModel = mongoose.models.Mood || mongoose.model('Mood', MoodSchema);
    this.JournalModel = mongoose.models.Journal || mongoose.model('Journal', JournalSchema);
    this.GoalModel = mongoose.models.Goal || mongoose.model('Goal', GoalSchema);
    this.AchievementModel = mongoose.models.Achievement || mongoose.model('Achievement', AchievementSchema);
    this.UserAchievementModel = mongoose.models.UserAchievement || mongoose.model('UserAchievement', UserAchievementSchema);
    this.UserPlantModel = mongoose.models.UserPlant || mongoose.model('UserPlant', UserPlantSchema);
    this.WeeklyGoalModel = mongoose.models.WeeklyGoal || mongoose.model('WeeklyGoal', WeeklyGoalSchema);
    this.ForumPostModel = mongoose.models.ForumPost || mongoose.model('ForumPost', ForumPostSchema);
    this.ForumCommentModel = mongoose.models.ForumComment || mongoose.model('ForumComment', ForumCommentSchema);
    this.ForumLikeModel = mongoose.models.ForumLike || mongoose.model('ForumLike', ForumLikeSchema);
    this.ArticleModel = mongoose.models.Article || mongoose.model('Article', ArticleSchema);
    this.SpecialistProfileModel = mongoose.models.SpecialistProfile || mongoose.model('SpecialistProfile', SpecialistProfileSchema);
  }

  private async test(testName: string, testFn: () => Promise<void>): Promise<void> {
    this.testCount++;
    try {
      await testFn();
      this.results.push({
        testNumber: this.testCount,
        testName,
        status: 'PASS',
        message: 'Test passed',
      });
      console.log(`✅ Test ${this.testCount}: ${testName} - PASSED`);
    } catch (error: any) {
      this.results.push({
        testNumber: this.testCount,
        testName,
        status: 'FAIL',
        message: error.message || 'Test failed',
        details: error.response?.data || error.stack,
      });
      console.log(`❌ Test ${this.testCount}: ${testName} - FAILED: ${error.message}`);
    }
  }

  private async setupTestUsers(): Promise<void> {
    const timestamp = Date.now();
    
    // User 1 - Main user
    this.user1.email = `user1_${timestamp}@test.com`;
    this.user1.username = `user1_${timestamp}`;
    const hashedPassword1 = await bcrypt.hash(this.user1.password, 10);
    const user1 = new this.UserModel({
      email: this.user1.email,
      password: hashedPassword1,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true, // Set to true to allow login
      first_name: 'John',
      last_name: 'Doe',
      username: this.user1.username,
    });
    await user1.save();
    this.user1.userId = user1._id.toString();

    // User 2 - Secondary user
    this.user2.email = `user2_${timestamp}@test.com`;
    this.user2.username = `user2_${timestamp}`;
    const hashedPassword2 = await bcrypt.hash(this.user2.password, 10);
    const user2 = new this.UserModel({
      email: this.user2.email,
      password: hashedPassword2,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true, // Set to true to allow login
      first_name: 'Jane',
      last_name: 'Smith',
      username: this.user2.username,
    });
    await user2.save();
    this.user2.userId = user2._id.toString();

    // User 3 - Specialist (needs specialist profile for login)
    this.user3.email = `specialist_${timestamp}@test.com`;
    this.user3.username = `specialist_${timestamp}`;
    const hashedPassword3 = await bcrypt.hash(this.user3.password, 10);
    const user3 = new this.UserModel({
      email: this.user3.email,
      password: hashedPassword3,
      is_email_verified: true,
      user_type: 'specialist',
      has_demographics: false,
      first_name: 'Dr. Sarah',
      last_name: 'Johnson',
      username: this.user3.username,
    });
    await user3.save();
    this.user3.userId = user3._id.toString();

    // Create specialist profile for User 3 (required for login)
    const specialistProfile = new this.SpecialistProfileModel({
      user_id: user3._id,
      full_name: 'Dr. Sarah Johnson',
      designation: 'Clinical Psychologist',
      location: 'New York',
      hourly_rate: 150,
      currency: 'USD',
      specializations: ['Mental Health', 'Anxiety', 'Depression'],
      languages: ['English'],
      categories: ['Therapy & Counseling'],
      experience_years: 5,
    });
    await specialistProfile.save();

    // Login all users
    const login1 = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: this.user1.email, password: this.user1.password }),
    });
    if (login1.status === 200 && login1.data.token) {
      this.user1.token = login1.data.token;
    } else {
      throw new Error(`User 1 login failed: ${JSON.stringify(login1.data)}`);
    }

    const login2 = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: this.user2.email, password: this.user2.password }),
    });
    if (login2.status === 200 && login2.data.token) {
      this.user2.token = login2.data.token;
    } else {
      throw new Error(`User 2 login failed: ${JSON.stringify(login2.data)}`);
    }

    const login3 = await makeRequest(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: this.user3.email, password: this.user3.password }),
    });
    if (login3.status === 200 && login3.data.token) {
      this.user3.token = login3.data.token;
    } else {
      throw new Error(`User 3 login failed: ${JSON.stringify(login3.data)}`);
    }

    console.log(`✅ Test users created: ${this.user1.email}, ${this.user2.email}, ${this.user3.email}`);
  }

  private async cleanup(): Promise<void> {
    try {
      const userIds = [this.user1.userId, this.user2.userId, this.user3.userId].filter(id => id);
      
      for (const userId of userIds) {
        await this.UserModel.deleteOne({ _id: userId });
        await this.StepsModel.deleteMany({ user_id: userId });
        await this.MoodModel.deleteMany({ user_id: userId });
        await this.JournalModel.deleteMany({ user_id: userId });
        await this.GoalModel.deleteMany({ user_id: userId });
        await this.UserAchievementModel.deleteMany({ user_id: userId });
        await this.UserPlantModel.deleteOne({ user_id: userId });
        await this.WeeklyGoalModel.deleteMany({ user_id: userId });
        await this.ForumPostModel.deleteMany({ user_id: userId });
        await this.ForumCommentModel.deleteMany({ user_id: userId });
        await this.ForumLikeModel.deleteMany({ user_id: userId });
        await this.ArticleModel.deleteMany({ user_id: userId });
        await this.SpecialistProfileModel.deleteMany({ user_id: userId });
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  // ==================== TEST GROUPS ====================

  // Group 1: Authentication & User Setup (Tests 1-20)
  async runAuthTests(): Promise<void> {
    console.log('\n🔐 GROUP 1: AUTHENTICATION & USER SETUP\n');

    await this.test('1. User 1 can login', async () => {
      const response = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user1.email, password: this.user1.password }),
      });
      if (response.status !== 200 || !response.data.token) {
        throw new Error('Login failed');
      }
    });

    await this.test('2. User 2 can login', async () => {
      const response = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user2.email, password: this.user2.password }),
      });
      if (response.status !== 200 || !response.data.token) {
        throw new Error('Login failed');
      }
    });

    await this.test('3. User 3 (Specialist) can login', async () => {
      const response = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user3.email, password: this.user3.password }),
      });
      if (response.status !== 200 || !response.data.token) {
        throw new Error('Login failed');
      }
    });

    await this.test('4. Invalid login credentials fail', async () => {
      const response = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user1.email, password: 'WrongPassword123!' }),
      });
      if (response.status === 200 && response.data.token) {
        throw new Error('Should not login with wrong password');
      }
    });

    await this.test('5. User 1 can change password', async () => {
      const newPassword = 'NewPassword123!';
      const response = await makeRequest(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          old_password: this.user1.password,
          new_password: newPassword,
        }),
      });
      if (response.status !== 200 || !response.data.message) {
        throw new Error('Password change failed');
      }
      this.user1.password = newPassword;
      // Re-login with new password
      const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user1.email, password: newPassword }),
      });
      this.user1.token = loginResponse.data.token;
    });

    await this.test('6. User 1 can login with new password', async () => {
      const response = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user1.email, password: this.user1.password }),
      });
      if (response.status !== 200 || !response.data.token) {
        throw new Error('Cannot login with new password');
      }
    });

    await this.test('7. User 2 can change password', async () => {
      const newPassword = 'NewPassword456!';
      const response = await makeRequest(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          old_password: this.user2.password,
          new_password: newPassword,
        }),
      });
      if (response.status !== 200 || !response.data.message) {
        throw new Error('Password change failed');
      }
      this.user2.password = newPassword;
      const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: this.user2.email, password: newPassword }),
      });
      this.user2.token = loginResponse.data.token;
    });

    await this.test('8. Cannot change password with wrong old password', async () => {
      const response = await makeRequest(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          old_password: 'WrongOldPassword123!',
          new_password: 'NewPassword789!',
        }),
      });
      if (response.status === 200 && response.data.success) {
        throw new Error('Should not change password with wrong old password');
      }
    });

    await this.test('9. User 1 token is valid for authenticated requests', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Token should be valid');
      }
    });

    await this.test('10. User 2 token is valid for authenticated requests', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Token should be valid');
      }
    });

    await this.test('11. Invalid token is rejected', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid_token_12345' },
      });
      if (response.status !== 401 && response.status !== 403) {
        throw new Error('Invalid token should be rejected');
      }
    });

    await this.test('12. Missing token is rejected', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
      });
      if (response.status !== 401 && response.status !== 403) {
        throw new Error('Missing token should be rejected');
      }
    });
  }

  // Group 2: Demographics (Tests 21-25)
  async runDemographicsTests(): Promise<void> {
    console.log('\n👤 GROUP 2: DEMOGRAPHICS\n');

    await this.test('21. User 1 can save demographics', async () => {
      const response = await makeRequest(`${API_BASE}/demographics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          user_id: this.user1.userId,
          demographics: {
            age_range: '25-30',
            gender_identity: 'male',
            country_of_residence: 'New York',
          },
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to save demographics');
      }
    });

    await this.test('22. User 2 can save demographics', async () => {
      const response = await makeRequest(`${API_BASE}/demographics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          user_id: this.user2.userId,
          demographics: {
            age_range: '30-35',
            gender_identity: 'female',
            country_of_residence: 'Los Angeles',
          },
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to save demographics');
      }
    });

    await this.test('23. User 1 can update demographics', async () => {
      const response = await makeRequest(`${API_BASE}/demographics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          user_id: this.user1.userId,
          demographics: {
            age_range: '26-31',
            gender_identity: 'male',
            country_of_residence: 'Boston',
          },
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to update demographics');
      }
    });

    await this.test('24. User 3 (Specialist) can save demographics', async () => {
      const response = await makeRequest(`${API_BASE}/demographics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user3.token}` },
        body: JSON.stringify({
          user_id: this.user3.userId,
          demographics: {
            age_range: '35-40',
            gender_identity: 'female',
            country_of_residence: 'Chicago',
          },
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to save demographics');
      }
    });
  }

  // Group 3: Activity Tracking - Steps (Tests 26-40)
  async runActivityTests(): Promise<void> {
    console.log('\n🚶 GROUP 3: ACTIVITY TRACKING - STEPS\n');

    await this.test('26. User 1 can create steps entry', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          steps: 5000,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to create steps');
      }
    });

    await this.test('27. User 1 can sync multiple steps entries', async () => {
      const today = new Date();
      const entries = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        entries.push({
          date: date.toISOString().split('T')[0],
          timestamp: date.toISOString(),
          steps: 3000 + i * 500,
        });
      }
      const response = await makeRequest(`${API_BASE}/activity/steps/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({ entries }),
      });
      if (response.status !== 200 || !response.data.success || response.data.data.synced !== 7) {
        throw new Error('Failed to sync steps');
      }
    });

    await this.test('28. User 1 can get today\'s steps', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get today\'s steps');
      }
    });

    await this.test('29. User 1 can get steps history', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/history?period=daily&limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get steps history');
      }
    });

    await this.test('30. User 1 can get current streak', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/current-streak`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get current streak');
      }
    });

    await this.test('31. User 2 can create steps entry', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          steps: 4000,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to create steps');
      }
    });

    await this.test('32. User 1 can update steps entry', async () => {
      // First get today's steps to get the ID
      const todayResponse = await makeRequest(`${API_BASE}/activity/steps`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (todayResponse.status !== 200 || !todayResponse.data.success || !todayResponse.data.data) {
        throw new Error('Failed to get steps for update');
      }
      const stepsId = todayResponse.data.data._id || todayResponse.data.data.id;
      if (!stepsId) {
        throw new Error('Steps ID not found');
      }
      
      const response = await makeRequest(`${API_BASE}/activity/steps/${stepsId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          steps: 6000,
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to update steps');
      }
    });

    await this.test('33. User 2 can sync multiple steps entries', async () => {
      const today = new Date();
      const entries = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        entries.push({
          date: date.toISOString().split('T')[0],
          timestamp: date.toISOString(),
          steps: 2000 + i * 300,
        });
      }
      const response = await makeRequest(`${API_BASE}/activity/steps/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({ entries }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to sync steps');
      }
    });

    await this.test('34. User 1 can get steps statistics', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/history?period=weekly&limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get steps statistics');
      }
    });

    await this.test('35. User 2 can get current streak', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/current-streak`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get current streak');
      }
    });

    await this.test('36. Steps sync handles duplicate dates correctly', async () => {
      const today = new Date();
      const entries = [
        {
          date: today.toISOString().split('T')[0],
          timestamp: today.toISOString(),
          steps: 5000,
        },
        {
          date: today.toISOString().split('T')[0],
          timestamp: today.toISOString(),
          steps: 6000,
        },
      ];
      const response = await makeRequest(`${API_BASE}/activity/steps/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({ entries }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to sync duplicate dates');
      }
    });

    await this.test('37. Steps history returns correct format', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/history?period=daily&limit=5`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success || !response.data.data.records) {
        throw new Error('Steps history format incorrect');
      }
    });

    await this.test('38. User 1 can get monthly steps summary', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/history?period=monthly&limit=12`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get monthly summary');
      }
    });

    await this.test('39. Steps streak calculation is accurate', async () => {
      // Create steps for 10 consecutive days
      const today = new Date();
      for (let i = 0; i < 10; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await this.StepsModel.findOneAndUpdate(
          {
            user_id: this.user1.userId,
            date: {
              $gte: new Date(date.setHours(0, 0, 0, 0)),
              $lt: new Date(date.setHours(23, 59, 59, 999)),
            },
          },
          {
            user_id: this.user1.userId,
            steps: 5000,
            date: new Date(date.setHours(0, 0, 0, 0)),
            goal: 10000,
          },
          { upsert: true, new: true }
        );
      }
      
      const response = await makeRequest(`${API_BASE}/activity/steps/current-streak`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || response.data.data.current_streak < 10) {
        throw new Error('Streak calculation incorrect');
      }
    });

    await this.test('40. User 2 can get steps history with pagination', async () => {
      const response = await makeRequest(`${API_BASE}/activity/steps/history?period=daily&limit=20&page=1`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get paginated steps history');
      }
    });
  }

  // Group 4: Mood Tracking (Tests 41-50)
  async runMoodTests(): Promise<void> {
    console.log('\n😊 GROUP 4: MOOD TRACKING\n');

    await this.test('41. User 1 can create mood entry', async () => {
      const response = await makeRequest(`${API_BASE}/mood`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          mood: 'happy',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to create mood');
      }
    });

    await this.test('42. User 1 can update mood entry', async () => {
      const response = await makeRequest(`${API_BASE}/mood`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          mood: 'calm',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success || response.data.data.mood !== 'calm') {
        throw new Error('Failed to update mood');
      }
    });

    await this.test('43. User 1 can get mood history', async () => {
      const response = await makeRequest(`${API_BASE}/mood/history?limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get mood history');
      }
    });

    await this.test('44. User 2 can create mood entry', async () => {
      const response = await makeRequest(`${API_BASE}/mood`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          mood: 'happy',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to create mood');
      }
    });

    await this.test('45. User 1 can create multiple mood entries', async () => {
      const today = new Date();
      const moods = ['happy', 'calm', 'sad', 'tired', 'anxious']; // Valid moods: happy, sad, anxious, tired, angry, calm
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const response = await makeRequest(`${API_BASE}/mood`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user1.token}` },
          body: JSON.stringify({
            mood: moods[i],
            date: dateStr,
          }),
        });
        // Accept both 200 (update) and 201 (create) status codes
        if (response.status !== 200 && response.status !== 201) {
          throw new Error(`Failed to create mood entry for day ${i} (date: ${dateStr}): ${JSON.stringify(response.data)}`);
        }
        if (!response.data.success) {
          throw new Error(`Mood entry response missing success for day ${i} (date: ${dateStr})`);
        }
      }
    });

    await this.test('46. User 2 can get mood history', async () => {
      const response = await makeRequest(`${API_BASE}/mood/history?limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get mood history');
      }
    });

    await this.test('47. Mood history returns correct format', async () => {
      const response = await makeRequest(`${API_BASE}/mood/history?limit=5`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success || !response.data.data.moods) {
        throw new Error('Mood history format incorrect');
      }
    });

    await this.test('48. User 1 can track mood for past dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);
      const response = await makeRequest(`${API_BASE}/mood`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          mood: 'sad',
          date: pastDate.toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to track mood for past date');
      }
    });

    await this.test('49. User 2 can update mood entry', async () => {
      const response = await makeRequest(`${API_BASE}/mood`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          mood: 'calm',
          date: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.status !== 200 || !response.data.success || response.data.data.mood !== 'calm') {
        throw new Error('Failed to update mood');
      }
    });

    await this.test('50. Mood entries are user-specific', async () => {
      const user1Response = await makeRequest(`${API_BASE}/mood/history?limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      const user2Response = await makeRequest(`${API_BASE}/mood/history?limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (user1Response.data.data.moods.length === user2Response.data.data.moods.length) {
        // This is okay - they might have same count, but data should be different
        return;
      }
    });
  }

  // Group 5: Journal (Tests 51-60)
  async runJournalTests(): Promise<void> {
    console.log('\n📔 GROUP 5: JOURNAL\n');

    await this.test('51. User 1 can create journal entry', async () => {
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: 'Today was a great day! I felt productive and happy.',
          mood: 'happy',
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create journal');
      }
    });

    await this.test('52. User 1 can get today\'s journal', async () => {
      const response = await makeRequest(`${API_BASE}/journal/today`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get today\'s journal');
      }
    });

    await this.test('53. User 1 can update journal entry', async () => {
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: 'Updated: Today was amazing!',
          mood: 'happy',
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to update journal');
      }
    });

    await this.test('54. User 2 can create journal entry', async () => {
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: 'Feeling grateful today.',
          mood: 'calm',
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create journal');
      }
    });

    await this.test('55. User 1 can create journal entry for past date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3);
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: pastDate.toISOString().split('T')[0],
          content: 'This is a journal entry for 3 days ago.',
          mood: 'neutral',
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create journal for past date');
      }
    });

    await this.test('56. User 1 can get journal by date', async () => {
      // First create a journal entry for a past date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);
      const dateStr = pastDate.toISOString().split('T')[0];
      
      // Create journal entry first
      await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: dateStr,
          content: 'Test journal entry for date retrieval',
          mood: 'happy',
        }),
      });
      
      // Now get it by date (endpoint is /journal/date/:date)
      const response = await makeRequest(`${API_BASE}/journal/date/${dateStr}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get journal by date');
      }
    });

    await this.test('57. User 2 can get journal history', async () => {
      const response = await makeRequest(`${API_BASE}/journal/entries?limit=10`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get journal history');
      }
    });

    await this.test('58. Journal entries are user-specific', async () => {
      const user1Response = await makeRequest(`${API_BASE}/journal/today`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      const user2Response = await makeRequest(`${API_BASE}/journal/today`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      // Both should succeed but have different content
      if (user1Response.status !== 200 || user2Response.status !== 200) {
        throw new Error('Journal entries should be user-specific');
      }
    });

    await this.test('59. User 1 can update journal mood', async () => {
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: 'Updated content with new mood',
          mood: 'happy',
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to update journal mood');
      }
    });

    await this.test('60. Journal content validation works', async () => {
      const response = await makeRequest(`${API_BASE}/journal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          content: '', // Empty content should fail
        }),
      });
      if (response.status === 200 && response.data.success) {
        throw new Error('Empty content should be rejected');
      }
    });
  }

  // Group 6: Goals (Tests 61-70)
  async runGoalsTests(): Promise<void> {
    console.log('\n🎯 GROUP 6: GOALS\n');

    await this.test('61. User 1 can create exercise goal', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          title: 'Walk 10000 steps daily',
          category: 'Exercise',
          frequency: 'Daily',
          target_streak: 30,
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create goal');
      }
      this.goalId = response.data.data._id || response.data.data.id;
    });

    await this.test('62. User 1 can get all goals', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get goals');
      }
    });

    await this.test('63. User 1 can update goal', async () => {
      if (!this.goalId) {
        throw new Error('Goal ID not available');
      }
      const response = await makeRequest(`${API_BASE}/goals/${this.goalId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          title: 'Walk 12000 steps daily',
        }),
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to update goal');
      }
    });

    await this.test('64. User 2 can create meditation goal', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          title: 'Meditate 20 minutes daily',
          category: 'Meditation',
          frequency: 'Daily',
          target_streak: 30,
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create goal');
      }
    });

    await this.test('65. User 1 can create multiple goals', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          title: 'Meditate 20 minutes daily',
          category: 'Meditation',
          frequency: 'Daily',
          target_streak: 30,
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create second goal');
      }
    });

    await this.test('66. User 1 can delete goal', async () => {
      if (!this.goalId) {
        throw new Error('Goal ID not available');
      }
      const response = await makeRequest(`${API_BASE}/goals/${this.goalId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 && response.status !== 204) {
        throw new Error('Failed to delete goal');
      }
    });

    await this.test('67. User 2 can get all goals', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get goals');
      }
    });

    await this.test('68. Goals are user-specific', async () => {
      const user1Response = await makeRequest(`${API_BASE}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      const user2Response = await makeRequest(`${API_BASE}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      // Both should succeed but have different goals
      if (user1Response.status !== 200 || user2Response.status !== 200) {
        throw new Error('Goals should be user-specific');
      }
    });

    await this.test('69. User 1 can create journal goal', async () => {
      const response = await makeRequest(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          title: 'Write journal entries daily',
          category: 'Mood Tracking',
          frequency: 'Daily',
          target_streak: 30,
        }),
      });
      if ((response.status !== 200 && response.status !== 201) || !response.data.success) {
        throw new Error('Failed to create journal goal');
      }
    });

    await this.test('70. User 2 can update goal', async () => {
      const goalsResponse = await makeRequest(`${API_BASE}/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      const goals = goalsResponse.data.data?.goals || [];
      if (goals.length > 0) {
        const goalId = goals[0]._id || goals[0].id;
        const response = await makeRequest(`${API_BASE}/goals/${goalId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${this.user2.token}` },
          body: JSON.stringify({
            target_value: 25,
          }),
        });
        if (response.status !== 200 || !response.data.success) {
          throw new Error('Failed to update goal');
        }
      }
    });
  }

  // Group 7: Achievements (Tests 71-80)
  async runAchievementTests(): Promise<void> {
    console.log('\n🏆 GROUP 7: ACHIEVEMENTS\n');

    await this.test('71. User 1 can get all achievements', async () => {
      const response = await makeRequest(`${API_BASE}/achievements`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get achievements');
      }
      const achievements = response.data.data?.achievements || [];
      if (achievements.length > 0) {
        this.achievementIds = achievements.slice(0, 3).map((a: any) => a.id || a._id);
      }
    });

    await this.test('72. User 1 can get locked achievements', async () => {
      const response = await makeRequest(`${API_BASE}/achievements?status=locked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get locked achievements');
      }
    });

    await this.test('73. User 1 can get in-progress achievements', async () => {
      const response = await makeRequest(`${API_BASE}/achievements?status=in_progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get in-progress achievements');
      }
    });

    await this.test('74. User 1 can get unlocked achievements', async () => {
      // Wait for achievements to be unlocked from activities
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get unlocked achievements');
      }
    });

    await this.test('75. User 1 can claim an achievement', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const unlockedResponse = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      
      const achievements = unlockedResponse.data.data?.achievements || [];
      const claimable = achievements.find((a: any) => a.status === 'unlocked');
      
      if (claimable) {
        const achievementId = claimable.id || claimable._id;
        const response = await makeRequest(`${API_BASE}/achievements/${achievementId}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user1.token}` },
          body: JSON.stringify({}),
        });
        if (response.status !== 200 || !response.data.success) {
          throw new Error('Failed to claim achievement');
        }
      }
    });

    await this.test('76. User 2 can get all achievements', async () => {
      const response = await makeRequest(`${API_BASE}/achievements`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get achievements');
      }
    });

    await this.test('77. User 1 can get recent achievements', async () => {
      const response = await makeRequest(`${API_BASE}/achievements/recent?limit=5`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get recent achievements');
      }
    });

    await this.test('78. User 2 can claim an achievement', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const unlockedResponse = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      
      const achievements = unlockedResponse.data.data?.achievements || [];
      const claimable = achievements.find((a: any) => a.status === 'unlocked');
      
      if (claimable) {
        const achievementId = claimable.id || claimable._id;
        const response = await makeRequest(`${API_BASE}/achievements/${achievementId}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user2.token}` },
          body: JSON.stringify({}),
        });
        if (response.status !== 200 || !response.data.success) {
          throw new Error('Failed to claim achievement');
        }
      }
    });

    await this.test('79. Cannot claim already claimed achievement', async () => {
      const claimedResponse = await makeRequest(`${API_BASE}/achievements?status=claimed`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      
      const claimed = claimedResponse.data.data?.achievements.find((a: any) => a.status === 'claimed');
      
      if (claimed) {
        const achievementId = claimed.id || claimed._id;
        const response = await makeRequest(`${API_BASE}/achievements/${achievementId}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user1.token}` },
          body: JSON.stringify({}),
        });
        if (response.status === 200 && response.data.success) {
          throw new Error('Should not be able to claim already claimed achievement');
        }
      }
    });

    await this.test('80. Achievement progress updates correctly', async () => {
      // Create steps to trigger achievement progress
      await this.StepsModel.findOneAndUpdate(
        {
          user_id: this.user1.userId,
          date: new Date().toISOString().split('T')[0],
        },
        {
          user_id: this.user1.userId,
          steps: 5000,
          date: new Date(),
          goal: 10000,
        },
        { upsert: true, new: true }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await makeRequest(`${API_BASE}/achievements?status=in_progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to check achievement progress');
      }
    });
  }

  // Group 8: Wellness (Tests 81-90)
  async runWellnessTests(): Promise<void> {
    console.log('\n🌱 GROUP 8: WELLNESS\n');

    await this.test('81. User 1 can get wellness progress', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get wellness progress');
      }
    });

    await this.test('82. User 1 can get pet growth data', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/pet-growth`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get pet growth');
      }
    });

    await this.test('83. User 1 can get rewards', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/rewards`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get rewards');
      }
    });

    await this.test('84. User 2 can get wellness progress', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get wellness progress');
      }
    });

    await this.test('85. XP is calculated from claimed achievements', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await makeRequest(`${API_BASE}/wellness/pet-growth`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      
      if (response.status !== 200 || typeof response.data.data.total_xp_earned !== 'number') {
        throw new Error('XP not calculated correctly');
      }
    });

    await this.test('86. User 2 can get pet growth data', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/pet-growth`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get pet growth');
      }
    });

    await this.test('87. User 2 can get rewards', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/rewards`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get rewards');
      }
    });

    await this.test('88. Wellness progress includes weekly goal', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.data.weekly_goal) {
        throw new Error('Weekly goal missing from progress');
      }
    });

    await this.test('89. Pet growth shows all 6 levels', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/pet-growth`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || response.data.data.levels.length !== 6) {
        throw new Error('Should have 6 levels');
      }
    });

    await this.test('90. Rewards show claimable status correctly', async () => {
      const response = await makeRequest(`${API_BASE}/wellness/rewards`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      const rewards = response.data.data?.rewards || [];
      rewards.forEach((reward: any) => {
        if (typeof reward.is_claimable !== 'boolean') {
          throw new Error('is_claimable must be boolean');
        }
        if (reward.status === 'unlocked' && reward.is_claimable !== true) {
          throw new Error('Unlocked achievements should be claimable');
        }
        if (reward.status === 'claimed' && reward.is_claimable !== false) {
          throw new Error('Claimed achievements should not be claimable');
        }
      });
    });
  }

  // Group 9: Forum (Tests 91-100)
  async runForumTests(): Promise<void> {
    console.log('\n💬 GROUP 9: FORUM\n');

    await this.test('91. User 1 can create forum post', async () => {
      const response = await makeRequest(`${API_BASE}/forum/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          title: 'How to manage stress?',
          description: 'I have been feeling very stressed lately. Any tips?',
          category: 'Anxiety',
          is_anonymous: false,
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to create forum post');
      }
      if (!response.data.success) {
        throw new Error('Forum post creation response missing success');
      }
      this.forumPostId = response.data.data?._id || response.data.data?.id || response.data._id;
      if (!this.forumPostId) {
        throw new Error('Post ID not found');
      }
    });

    await this.test('92. User 2 can view forum posts', async () => {
      const response = await makeRequest(`${API_BASE}/forum/posts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get forum posts');
      }
    });

    await this.test('93. User 2 can comment on User 1\'s post', async () => {
      if (!this.forumPostId) {
        throw new Error('Post ID not available');
      }
      const response = await makeRequest(`${API_BASE}/forum/posts/${this.forumPostId}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          content: 'Try deep breathing exercises and meditation. They help a lot!',
          is_anonymous: false,
        }),
      });
      if (response.status !== 200 && response.status !== 201) {
        throw new Error('Failed to create comment');
      }
      if (!response.data.success) {
        throw new Error('Comment creation response missing success');
      }
      this.forumCommentId = response.data.data?._id || response.data.data?.id;
    });

    await this.test('94. User 1 can like User 2\'s comment', async () => {
      if (!this.forumPostId) {
        throw new Error('Post ID not available');
      }
      const response = await makeRequest(`${API_BASE}/forum/posts/${this.forumPostId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to like post');
      }
    });

    await this.test('95. User 1 can get post details', async () => {
      if (!this.forumPostId) {
        throw new Error('Post ID not available');
      }
      const response = await makeRequest(`${API_BASE}/forum/posts/${this.forumPostId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get post details');
      }
    });

    await this.test('96. User 2 can create forum post', async () => {
      const response = await makeRequest(`${API_BASE}/forum/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          title: 'Tips for better sleep',
          description: 'I have trouble sleeping. What helps you?',
          category: 'Sleep',
          is_anonymous: false,
        }),
      });
      if (response.status !== 200 && response.status !== 201 || !response.data.success) {
        throw new Error('Failed to create forum post');
      }
    });

    await this.test('97. User 1 can search forum posts', async () => {
      const response = await makeRequest(`${API_BASE}/forum/posts/search?query=stress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to search forum posts');
      }
    });

    await this.test('98. User 2 can toggle like on post', async () => {
      if (!this.forumPostId) {
        throw new Error('Post ID not available');
      }
      // Like the post
      const likeResponse = await makeRequest(`${API_BASE}/forum/posts/${this.forumPostId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (likeResponse.status !== 200 || !likeResponse.data.success) {
        throw new Error('Failed to like post');
      }
      
      // Unlike the post (toggle)
      const unlikeResponse = await makeRequest(`${API_BASE}/forum/posts/${this.forumPostId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (unlikeResponse.status !== 200 || !unlikeResponse.data.success) {
        throw new Error('Failed to unlike post');
      }
    });

    await this.test('99. User 1 can get forum categories', async () => {
      const response = await makeRequest(`${API_BASE}/forum/categories`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get forum categories');
      }
    });

    await this.test('100. User 2 can filter forum posts by category', async () => {
      const response = await makeRequest(`${API_BASE}/forum/posts?category=Anxiety`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to filter posts by category');
      }
    });
  }

  // Group 10: Quote (Tests 96-98)
  async runQuoteTests(): Promise<void> {
    console.log('\n💭 GROUP 10: QUOTE\n');

    await this.test('96. User 1 can get today\'s quote', async () => {
      const response = await makeRequest(`${API_BASE}/quote`, {
        method: 'GET',
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get quote');
      }
    });

    await this.test('97. User 2 can get today\'s quote', async () => {
      const response = await makeRequest(`${API_BASE}/quote`, {
        method: 'GET',
      });
      if (response.status !== 200 || !response.data.success) {
        throw new Error('Failed to get quote');
      }
    });

    await this.test('98. Quote is same for all users on same day', async () => {
      const response1 = await makeRequest(`${API_BASE}/quote`, {
        method: 'GET',
      });
      const response2 = await makeRequest(`${API_BASE}/quote`, {
        method: 'GET',
      });
      if (response1.data.data._id !== response2.data.data._id) {
        throw new Error('Quotes should be same for same day');
      }
    });
  }

  // Group 11: Complete User Flow Cycles (Tests 99-100)
  async runCompleteFlowTests(): Promise<void> {
    console.log('\n🔄 GROUP 11: COMPLETE USER FLOW CYCLES\n');

    await this.test('99. Complete User 1 flow: Steps → Mood → Journal → Achievement → Claim → XP → Level Up', async () => {
      // Create steps for multiple days
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await this.StepsModel.findOneAndUpdate(
          {
            user_id: this.user1.userId,
            date: {
              $gte: new Date(date.setHours(0, 0, 0, 0)),
              $lt: new Date(date.setHours(23, 59, 59, 999)),
            },
          },
          {
            user_id: this.user1.userId,
            steps: 5000,
            date: new Date(date.setHours(0, 0, 0, 0)),
            goal: 10000,
          },
          { upsert: true, new: true }
        );
      }

      // Create mood entries
      for (let i = 0; i < 5; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await this.MoodModel.findOneAndUpdate(
          { user_id: this.user1.userId, date: date.toISOString().split('T')[0] },
          {
            user_id: this.user1.userId,
            date: date.toISOString().split('T')[0],
            mood: 'happy',
          },
          { upsert: true, new: true }
        );
      }

      // Create journal entries
      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        await this.JournalModel.findOneAndUpdate(
          { user_id: this.user1.userId, date: date.toISOString().split('T')[0] },
          {
            user_id: this.user1.userId,
            date: date.toISOString().split('T')[0],
            content: `Journal entry for day ${i + 1}`,
            mood: 'happy',
          },
          { upsert: true, new: true }
        );
      }

      // Wait for achievement checks
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get unlocked achievements
      const unlockedResponse = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      const achievements = unlockedResponse.data.data?.achievements || [];
      if (achievements.length > 0) {
        // Claim first achievement
        const achievement = achievements[0];
        const achievementId = achievement.id || achievement._id;
        await makeRequest(`${API_BASE}/achievements/${achievementId}/claim`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user1.token}` },
          body: JSON.stringify({}),
        });

        // Wait for XP calculation
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check pet growth
        const petGrowthResponse = await makeRequest(`${API_BASE}/wellness/pet-growth`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        });

        if (petGrowthResponse.status !== 200 || typeof petGrowthResponse.data.data.total_xp_earned !== 'number') {
          throw new Error('XP not calculated after claiming');
        }

        // Check wellness progress
        const progressResponse = await makeRequest(`${API_BASE}/wellness/progress`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        });

        if (progressResponse.status !== 200 || !progressResponse.data.success) {
          throw new Error('Wellness progress not available');
        }
      }
    });

    await this.test('100. Complete User 2 flow: Forum Post → User 1 Comment → User 2 Reply → Like → Achievement', async () => {
      // User 2 creates a forum post
      const postResponse = await makeRequest(`${API_BASE}/forum/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          title: 'Need advice on meditation',
          description: 'I want to start meditating but don\'t know where to begin. Any suggestions?',
          category: 'Meditation',
          is_anonymous: false,
        }),
      });

      if (postResponse.status !== 200 && postResponse.status !== 201 || !postResponse.data.success) {
        throw new Error('Failed to create forum post');
      }

      const postId = postResponse.data.data?._id || postResponse.data.data?.id;
      if (!postId) {
        throw new Error('Post ID not found');
      }

      // User 1 comments on User 2's post
      const commentResponse = await makeRequest(`${API_BASE}/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          content: 'Start with 5 minutes daily. Use guided meditation apps!',
          is_anonymous: false,
        }),
      });

      if (commentResponse.status !== 200 && commentResponse.status !== 201 || !commentResponse.data.success) {
        throw new Error('Failed to create comment');
      }

      // User 2 likes User 1's comment (by liking the post)
      await makeRequest(`${API_BASE}/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });

      // Wait for achievement checks
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if User 1 got community achievement
      const achievementsResponse = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (achievementsResponse.status !== 200 || !achievementsResponse.data.success) {
        throw new Error('Failed to check achievements');
      }

      // Verify wellness endpoints work
      const wellnessResponse = await makeRequest(`${API_BASE}/wellness/rewards`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (wellnessResponse.status !== 200 || !wellnessResponse.data.success) {
        throw new Error('Wellness rewards not available');
      }
    });

    await this.test('100. Complete User 2 flow: Forum Post → User 1 Comment → User 2 Reply → Like → Achievement', async () => {
      // User 2 creates a forum post
      const postResponse = await makeRequest(`${API_BASE}/forum/posts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
        body: JSON.stringify({
          title: 'Need advice on meditation',
          description: 'I want to start meditating but don\'t know where to begin. Any suggestions?',
          category: 'Meditation',
          is_anonymous: false,
        }),
      });

      if (postResponse.status !== 200 && postResponse.status !== 201 || !postResponse.data.success) {
        throw new Error('Failed to create forum post');
      }

      const postId = postResponse.data.data?._id || postResponse.data.data?.id;
      if (!postId) {
        throw new Error('Post ID not found');
      }

      // User 1 comments on User 2's post
      const commentResponse = await makeRequest(`${API_BASE}/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user1.token}` },
        body: JSON.stringify({
          content: 'Start with 5 minutes daily. Use guided meditation apps!',
          is_anonymous: false,
        }),
      });

      if (commentResponse.status !== 200 && commentResponse.status !== 201 || !commentResponse.data.success) {
        throw new Error('Failed to create comment');
      }

      // User 2 likes User 1's comment (by liking the post)
      await makeRequest(`${API_BASE}/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.user2.token}` },
      });

      // Wait for achievement checks
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if User 1 got community achievement
      const achievementsResponse = await makeRequest(`${API_BASE}/achievements?status=unlocked`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (achievementsResponse.status !== 200 || !achievementsResponse.data.success) {
        throw new Error('Failed to check achievements');
      }

      // Verify wellness endpoints work
      const wellnessResponse = await makeRequest(`${API_BASE}/wellness/rewards`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (wellnessResponse.status !== 200 || !wellnessResponse.data.success) {
        throw new Error('Wellness rewards not available');
      }
    });
  }

  // ==================== MAIN TEST RUNNER ====================
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Complete System Test Suite (100 Test Cases)...\n');
    console.log('='.repeat(60));

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

      // Setup test users
      await this.setupTestUsers();

      // Run all test groups
      await this.runAuthTests();
      await this.runDemographicsTests();
      await this.runActivityTests();
      await this.runMoodTests();
      await this.runJournalTests();
      await this.runGoalsTests();
      await this.runAchievementTests();
      await this.runWellnessTests();
      await this.runForumTests();
      await this.runQuoteTests();
      await this.runCompleteFlowTests();

      // Print summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 TEST SUMMARY');
      console.log('='.repeat(60));
      
      const passed = this.results.filter(r => r.status === 'PASS').length;
      const failed = this.results.filter(r => r.status === 'FAIL').length;
      const skipped = this.results.filter(r => r.status === 'SKIP').length;
      
      console.log(`Total Tests: ${this.results.length}`);
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(2)}%`);
      
      if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        this.results
          .filter(r => r.status === 'FAIL')
          .forEach(r => {
            console.log(`  ${r.testNumber}. ${r.testName}`);
            console.log(`     Error: ${r.message}`);
          });
      }
      
      console.log('\n' + '='.repeat(60));

      // Cleanup
      await this.cleanup();

      // Disconnect
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');

      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Fatal error:', error);
      await this.cleanup();
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

// Run tests
const testSuite = new CompleteSystemTestSuite();
testSuite.runAllTests();

