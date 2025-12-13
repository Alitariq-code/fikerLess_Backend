import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { Goal, GoalSchema } from '../src/models/schemas/goal.schema';
import { Mood, MoodSchema } from '../src/models/schemas/mood.schema';
import { Steps, StepsSchema } from '../src/models/schemas/steps.schema';
import { Journal, JournalSchema } from '../src/models/schemas/journal.schema';

// Load .env file manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const BASE_URL = process.env.API_URL || 'http://localhost:5002';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function testPass(name: string, details?: any) {
  results.push({ name, passed: true, details });
  console.log(`✅ ${name}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

function testFail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.log(`❌ ${name}`);
  console.log(`   Error: ${error}`);
}

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

async function testGoalsComplete() {
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
    console.log('Connected to MongoDB\n');

    // Create models
    let UserModel, GoalModel, MoodModel, StepsModel, JournalModel;
    try {
      UserModel = mongoose.model('User');
    } catch {
      UserModel = mongoose.model('User', UserSchema);
    }
    try {
      GoalModel = mongoose.model('Goal');
    } catch {
      GoalModel = mongoose.model('Goal', GoalSchema);
    }
    try {
      MoodModel = mongoose.model('Mood');
    } catch {
      MoodModel = mongoose.model('Mood', MoodSchema);
    }
    try {
      StepsModel = mongoose.model('Steps');
    } catch {
      StepsModel = mongoose.model('Steps', StepsSchema);
    }
    try {
      JournalModel = mongoose.model('Journal');
    } catch {
      JournalModel = mongoose.model('Journal', JournalSchema);
    }

    // Create test users
    const secretKey = process.env.SECRET_KEY || 'default-secret';
    const user1Email = `test-goals-user1-${Date.now()}@test.com`;
    const user2Email = `test-goals-user2-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const user1 = new UserModel({
      email: user1Email,
      password: hashedPassword,
      name: 'Test User 1',
      is_email_verified: true,
      has_demographics: true,
      user_type: 'user',
    });
    await user1.save();
    const userId1 = user1._id.toString();

    const user2 = new UserModel({
      email: user2Email,
      password: hashedPassword,
      name: 'Test User 2',
      is_email_verified: true,
      has_demographics: true,
      user_type: 'user',
    });
    await user2.save();
    const userId2 = user2._id.toString();

    // Generate tokens (must include email for getUserFromToken to work)
    const token1 = jwt.sign({ 
      user_id: userId1,
      email: user1Email,
      user_type: 'user',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }, secretKey, { algorithm: 'HS256' });
    const token2 = jwt.sign({ 
      user_id: userId2,
      email: user2Email,
      user_type: 'user',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }, secretKey, { algorithm: 'HS256' });

    console.log('==========================================');
    console.log('Goals Feature - Comprehensive Test Suite');
    console.log('==========================================\n');

    let goalId1: string | null = null;
    let goalId2: string | null = null;
    let goalId3: string | null = null;
    let goalId4: string | null = null;

    // ==========================================
    // TEST GROUP 1: Goal Creation (Tests 1-6)
    // ==========================================
    console.log('--- Test Group 1: Goal Creation ---\n');

    // Test 1: Create Daily Mood Tracking Goal
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Daily Mood Check-in',
          category: 'Mood Tracking',
          frequency: 'Daily',
        }),
      });
      if (response.status === 201 && response.data.success && response.data.data) {
        goalId1 = response.data.data._id;
        if (response.data.data.status === 'in_progress' && response.data.data.current_streak === 0) {
          testPass('Test 1: Create Daily Mood Tracking Goal', { goalId: goalId1 });
        } else {
          testFail('Test 1: Create Daily Mood Tracking Goal', 'Goal status or streak incorrect');
        }
      } else {
        testFail('Test 1: Create Daily Mood Tracking Goal', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 1: Create Daily Mood Tracking Goal', error.message);
    }

    // Test 2: Create Weekly Exercise Goal with Target Streak
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Weekly Exercise',
          category: 'Exercise',
          frequency: 'Weekly',
          target_streak: 4,
        }),
      });
      if (response.status === 201 && response.data.success && response.data.data) {
        goalId2 = response.data.data._id;
        if (response.data.data.target_streak === 4) {
          testPass('Test 2: Create Weekly Exercise Goal with Target Streak', { goalId: goalId2 });
        } else {
          testFail('Test 2: Create Weekly Exercise Goal with Target Streak', 'Target streak not set correctly');
        }
      } else {
        testFail('Test 2: Create Weekly Exercise Goal with Target Streak', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 2: Create Weekly Exercise Goal with Target Streak', error.message);
    }

    // Test 3: Create Meditation Goal
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Daily Meditation',
          category: 'Meditation',
          frequency: 'Daily',
        }),
      });
      if (response.status === 201 && response.data.success) {
        goalId3 = response.data.data._id;
        testPass('Test 3: Create Meditation Goal', { goalId: goalId3 });
      } else {
        testFail('Test 3: Create Meditation Goal', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 3: Create Meditation Goal', error.message);
    }

    // Test 4: Create Read Article Goal
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Read Articles Weekly',
          category: 'Read an Article',
          frequency: 'Weekly',
        }),
      });
      if (response.status === 201 && response.data.success) {
        goalId4 = response.data.data._id;
        testPass('Test 4: Create Read Article Goal', { goalId: goalId4 });
      } else {
        testFail('Test 4: Create Read Article Goal', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 4: Create Read Article Goal', error.message);
    }

    // Test 5: Create Goal - Missing Required Fields (Validation)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Incomplete Goal',
          // Missing category and frequency
        }),
      });
      if (response.status === 400) {
        testPass('Test 5: Create Goal - Missing Required Fields (Validation)');
      } else {
        testFail('Test 5: Create Goal - Missing Required Fields (Validation)', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 5: Create Goal - Missing Required Fields (Validation)', error.message);
    }

    // Test 6: Create Goal - Unauthenticated
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Unauthenticated Goal',
          category: 'Exercise',
          frequency: 'Daily',
        }),
      });
      if (response.status === 401) {
        testPass('Test 6: Create Goal - Unauthenticated');
      } else {
        testFail('Test 6: Create Goal - Unauthenticated', `Expected 401, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 6: Create Goal - Unauthenticated', error.message);
    }

    // ==========================================
    // TEST GROUP 2: Goal Retrieval (Tests 7-12)
    // ==========================================
    console.log('\n--- Test Group 2: Goal Retrieval ---\n');

    // Test 7: Get All Goals (Default - In Progress)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 200 && response.data.success && Array.isArray(response.data.data)) {
        const inProgressGoals = response.data.data.filter((g: any) => g.status === 'in_progress');
        if (inProgressGoals.length >= 4) {
          testPass('Test 7: Get All Goals (Default - In Progress)', { count: response.data.data.length });
        } else {
          testFail('Test 7: Get All Goals (Default - In Progress)', 'Not all goals returned');
        }
      } else {
        testFail('Test 7: Get All Goals (Default - In Progress)', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 7: Get All Goals (Default - In Progress)', error.message);
    }

    // Test 8: Get Goals - Filter by Status (In Progress)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals?status=in_progress`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 200 && response.data.success) {
        const allInProgress = response.data.data.every((g: any) => g.status === 'in_progress');
        if (allInProgress) {
          testPass('Test 8: Get Goals - Filter by Status (In Progress)', { count: response.data.data.length });
        } else {
          testFail('Test 8: Get Goals - Filter by Status (In Progress)', 'Some goals are not in_progress');
        }
      } else {
        testFail('Test 8: Get Goals - Filter by Status (In Progress)', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 8: Get Goals - Filter by Status (In Progress)', error.message);
    }

    // Test 9: Get Goals - Filter by Status (Completed)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals?status=completed`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 200 && response.data.success) {
        testPass('Test 9: Get Goals - Filter by Status (Completed)', { count: response.data.data.length });
      } else {
        testFail('Test 9: Get Goals - Filter by Status (Completed)', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 9: Get Goals - Filter by Status (Completed)', error.message);
    }

    // Test 10: Get Goals - Filter by Status (All)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals?status=all`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 200 && response.data.success && response.data.summary) {
        testPass('Test 10: Get Goals - Filter by Status (All)', { summary: response.data.summary });
      } else {
        testFail('Test 10: Get Goals - Filter by Status (All)', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 10: Get Goals - Filter by Status (All)', error.message);
    }

    // Test 11: Get Single Goal by ID
    if (goalId1) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        if (response.status === 200 && response.data.success && response.data.data._id === goalId1) {
          testPass('Test 11: Get Single Goal by ID', { goalId: goalId1 });
        } else {
          testFail('Test 11: Get Single Goal by ID', JSON.stringify(response.data));
        }
      } catch (error: any) {
        testFail('Test 11: Get Single Goal by ID', error.message);
      }
    } else {
      testFail('Test 11: Get Single Goal by ID', 'Goal ID not available');
    }

    // Test 12: Get Single Goal - Invalid ID
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals/invalid-id-123`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 400) {
        testPass('Test 12: Get Single Goal - Invalid ID');
      } else {
        testFail('Test 12: Get Single Goal - Invalid ID', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 12: Get Single Goal - Invalid ID', error.message);
    }

    // ==========================================
    // TEST GROUP 3: Goal Updates (Tests 13-16)
    // ==========================================
    console.log('\n--- Test Group 3: Goal Updates ---\n');

    // Test 13: Update Goal Title
    if (goalId1) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            title: 'Updated Daily Mood Check-in',
          }),
        });
        if (response.status === 200 && response.data.success && response.data.data.title === 'Updated Daily Mood Check-in') {
          testPass('Test 13: Update Goal Title');
        } else {
          testFail('Test 13: Update Goal Title', JSON.stringify(response.data));
        }
      } catch (error: any) {
        testFail('Test 13: Update Goal Title', error.message);
      }
    } else {
      testFail('Test 13: Update Goal Title', 'Goal ID not available');
    }

    // Test 14: Update Goal Target Streak
    if (goalId2) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId2}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            target_streak: 8,
          }),
        });
        if (response.status === 200 && response.data.success && response.data.data.target_streak === 8) {
          testPass('Test 14: Update Goal Target Streak');
        } else {
          testFail('Test 14: Update Goal Target Streak', JSON.stringify(response.data));
        }
      } catch (error: any) {
        testFail('Test 14: Update Goal Target Streak', error.message);
      }
    } else {
      testFail('Test 14: Update Goal Target Streak', 'Goal ID not available');
    }

    // Test 15: Update Goal - Unauthorized (Another User's Goal)
    if (goalId1) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token2}` },
          body: JSON.stringify({
            title: 'Hacked Goal',
          }),
        });
        if (response.status === 403) {
          testPass('Test 15: Update Goal - Unauthorized (Another User\'s Goal)');
        } else {
          testFail('Test 15: Update Goal - Unauthorized (Another User\'s Goal)', `Expected 403, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 15: Update Goal - Unauthorized (Another User\'s Goal)', error.message);
      }
    } else {
      testFail('Test 15: Update Goal - Unauthorized (Another User\'s Goal)', 'Goal ID not available');
    }

    // Test 16: Update Goal - Not Found
    try {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await makeRequest(`${BASE_URL}/api/v1/goals/${fakeId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Non-existent Goal',
        }),
      });
      if (response.status === 404) {
        testPass('Test 16: Update Goal - Not Found');
      } else {
        testFail('Test 16: Update Goal - Not Found', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 16: Update Goal - Not Found', error.message);
    }

    // ==========================================
    // TEST GROUP 4: Goal Completion (Tests 17-20)
    // ==========================================
    console.log('\n--- Test Group 4: Goal Completion ---\n');

    // Test 17: Complete Goal
    if (goalId4) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId4}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
        });
        if (response.status === 200 && response.data.success && response.data.data.status === 'completed' && response.data.data.completed_at) {
          testPass('Test 17: Complete Goal');
        } else {
          testFail('Test 17: Complete Goal', JSON.stringify(response.data));
        }
      } catch (error: any) {
        testFail('Test 17: Complete Goal', error.message);
      }
    } else {
      testFail('Test 17: Complete Goal', 'Goal ID not available');
    }

    // Test 18: Complete Already Completed Goal
    if (goalId4) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId4}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
        });
        if (response.status === 400) {
          testPass('Test 18: Complete Already Completed Goal');
        } else {
          testFail('Test 18: Complete Already Completed Goal', `Expected 400, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 18: Complete Already Completed Goal', error.message);
      }
    } else {
      testFail('Test 18: Complete Already Completed Goal', 'Goal ID not available');
    }

    // Test 19: Complete Goal - Unauthorized
    if (goalId1) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}/complete`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token2}` },
        });
        if (response.status === 403) {
          testPass('Test 19: Complete Goal - Unauthorized');
        } else {
          testFail('Test 19: Complete Goal - Unauthorized', `Expected 403, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 19: Complete Goal - Unauthorized', error.message);
      }
    } else {
      testFail('Test 19: Complete Goal - Unauthorized', 'Goal ID not available');
    }

    // Test 20: Complete Goal - Not Found
    try {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await makeRequest(`${BASE_URL}/api/v1/goals/${fakeId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 404) {
        testPass('Test 20: Complete Goal - Not Found');
      } else {
        testFail('Test 20: Complete Goal - Not Found', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 20: Complete Goal - Not Found', error.message);
    }

    // ==========================================
    // TEST GROUP 5: Automatic Progress Tracking (Tests 21-26)
    // ==========================================
    console.log('\n--- Test Group 5: Automatic Progress Tracking ---\n');

    // Test 21: Mood Tracking Goal - Automatic Progress Update
    if (goalId1) {
      try {
        // Create a mood entry to trigger automatic progress
        const today = new Date().toISOString().split('T')[0];
        const moodResponse = await makeRequest(`${BASE_URL}/api/v1/mood`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            mood: 'happy',
          }),
        });
        
        // Wait a bit for async goal update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check goal progress
        const goalResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        if (goalResponse.status === 200 && goalResponse.data.success) {
          const goal = goalResponse.data.data;
          if (goal.current_streak >= 1 && goal.last_completed_date) {
            testPass('Test 21: Mood Tracking Goal - Automatic Progress Update', { streak: goal.current_streak });
          } else {
            testFail('Test 21: Mood Tracking Goal - Automatic Progress Update', 'Streak not updated');
          }
        } else {
          testFail('Test 21: Mood Tracking Goal - Automatic Progress Update', JSON.stringify(goalResponse.data));
        }
      } catch (error: any) {
        testFail('Test 21: Mood Tracking Goal - Automatic Progress Update', error.message);
      }
    } else {
      testFail('Test 21: Mood Tracking Goal - Automatic Progress Update', 'Goal ID not available');
    }

    // Test 22: Exercise Goal - Automatic Progress Update (Steps)
    if (goalId2) {
      try {
        // Get current streak before update
        const goalBeforeResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId2}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        const streakBefore = goalBeforeResponse.data.data.current_streak;
        
        // Reset last_completed_date to null to ensure fresh update
        await GoalModel.findByIdAndUpdate(goalId2, {
          last_completed_date: null,
          current_streak: 0,
        });
        
        // Create steps entry to trigger automatic progress
        const today = new Date().toISOString().split('T')[0];
        const stepsResponse = await makeRequest(`${BASE_URL}/api/v1/steps`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            steps: 5000,
          }),
        });
        
        // Wait a bit for async goal update
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check goal progress
        const goalResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId2}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        if (goalResponse.status === 200 && goalResponse.data.success) {
          const goal = goalResponse.data.data;
          if (goal.last_completed_date && goal.current_streak >= 1) {
            testPass('Test 22: Exercise Goal - Automatic Progress Update (Steps)', { streak: goal.current_streak });
          } else {
            testFail('Test 22: Exercise Goal - Automatic Progress Update (Steps)', `Progress not updated. Streak: ${goal.current_streak}, Last completed: ${goal.last_completed_date}`);
          }
        } else {
          testFail('Test 22: Exercise Goal - Automatic Progress Update (Steps)', JSON.stringify(goalResponse.data));
        }
      } catch (error: any) {
        testFail('Test 22: Exercise Goal - Automatic Progress Update (Steps)', error.message);
      }
    } else {
      testFail('Test 22: Exercise Goal - Automatic Progress Update (Steps)', 'Goal ID not available');
    }

    // Test 23: Meditation Goal - Automatic Progress Update (Journal)
    if (goalId3) {
      try {
        // Create journal entry to trigger automatic progress
        const today = new Date().toISOString().split('T')[0];
        const journalResponse = await makeRequest(`${BASE_URL}/api/v1/journal`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            content: 'Had a peaceful meditation session today. Feeling calm and centered.',
            mood: 'calm',
          }),
        });
        
        // Wait a bit for async goal update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check goal progress
        const goalResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId3}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        if (goalResponse.status === 200 && goalResponse.data.success) {
          const goal = goalResponse.data.data;
          if (goal.last_completed_date) {
            testPass('Test 23: Meditation Goal - Automatic Progress Update (Journal)', { streak: goal.current_streak });
          } else {
            testFail('Test 23: Meditation Goal - Automatic Progress Update (Journal)', 'Progress not updated');
          }
        } else {
          testFail('Test 23: Meditation Goal - Automatic Progress Update (Journal)', JSON.stringify(goalResponse.data));
        }
      } catch (error: any) {
        testFail('Test 23: Meditation Goal - Automatic Progress Update (Journal)', error.message);
      }
    } else {
      testFail('Test 23: Meditation Goal - Automatic Progress Update (Journal)', 'Goal ID not available');
    }

    // Test 24: Daily Goal - Streak Continuation (Same Day - No Update)
    if (goalId1) {
      try {
        // Create another mood entry on the same day
        const today = new Date().toISOString().split('T')[0];
        await makeRequest(`${BASE_URL}/api/v1/mood`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            mood: 'calm',
          }),
        });
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get current streak
        const goalResponse1 = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        const streak1 = goalResponse1.data.data.current_streak;
        
        // Create another mood entry on the same day
        await makeRequest(`${BASE_URL}/api/v1/mood`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            mood: 'happy',
          }),
        });
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get streak again - should be the same
        const goalResponse2 = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        const streak2 = goalResponse2.data.data.current_streak;
        
        if (streak1 === streak2) {
          testPass('Test 24: Daily Goal - Streak Continuation (Same Day - No Update)', { streak: streak1 });
        } else {
          testFail('Test 24: Daily Goal - Streak Continuation (Same Day - No Update)', `Streak changed: ${streak1} -> ${streak2}`);
        }
      } catch (error: any) {
        testFail('Test 24: Daily Goal - Streak Continuation (Same Day - No Update)', error.message);
      }
    } else {
      testFail('Test 24: Daily Goal - Streak Continuation (Same Day - No Update)', 'Goal ID not available');
    }

    // Test 25: Daily Goal - Streak Reset After Missing Days
    if (goalId1) {
      try {
        // Get current streak
        const goalResponse1 = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        const currentStreak = goalResponse1.data.data.current_streak;
        
        // Manually set last_completed_date to 3 days ago to simulate missing days
        await GoalModel.findByIdAndUpdate(goalId1, {
          last_completed_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        });
        
        // Create mood entry today
        const today = new Date().toISOString().split('T')[0];
        await makeRequest(`${BASE_URL}/api/v1/mood`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            date: today,
            mood: 'happy',
          }),
        });
        
        // Wait for async update
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check goal - streak should reset to 1
        const goalResponse2 = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        if (goalResponse2.status === 200 && goalResponse2.data.success) {
          const goal = goalResponse2.data.data;
          if (goal.current_streak === 1) {
            testPass('Test 25: Daily Goal - Streak Reset After Missing Days', { streak: goal.current_streak });
          } else {
            testFail('Test 25: Daily Goal - Streak Reset After Missing Days', `Expected streak 1, got ${goal.current_streak}`);
          }
        } else {
          testFail('Test 25: Daily Goal - Streak Reset After Missing Days', JSON.stringify(goalResponse2.data));
        }
      } catch (error: any) {
        testFail('Test 25: Daily Goal - Streak Reset After Missing Days', error.message);
      }
    } else {
      testFail('Test 25: Daily Goal - Streak Reset After Missing Days', 'Goal ID not available');
    }

    // Test 26: Weekly Goal - Progress Update
    if (goalId2) {
      try {
        // Create a new weekly goal for this test to avoid conflicts
        const weeklyGoalResponse = await makeRequest(`${BASE_URL}/api/v1/goals`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
          body: JSON.stringify({
            title: 'Weekly Exercise Test',
            category: 'Exercise',
            frequency: 'Weekly',
          }),
        });
        
        if (weeklyGoalResponse.status !== 201 || !weeklyGoalResponse.data.success) {
          testFail('Test 26: Weekly Goal - Progress Update', 'Failed to create weekly goal');
        } else {
          const weeklyGoalId = weeklyGoalResponse.data.data._id;
          
          // Manually set last_completed_date to exactly 7 days ago
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          sevenDaysAgo.setHours(0, 0, 0, 0);
          
          await GoalModel.findByIdAndUpdate(weeklyGoalId, {
            last_completed_date: sevenDaysAgo,
            current_streak: 1,
          });
          
          // Create steps entry today
          const today = new Date().toISOString().split('T')[0];
          await makeRequest(`${BASE_URL}/api/v1/steps`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token1}` },
            body: JSON.stringify({
              date: today,
              steps: 8000,
            }),
          });
          
          // Wait for async update
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check goal - streak should increment to 2
          const goalResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${weeklyGoalId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token1}` },
          });
          
          if (goalResponse.status === 200 && goalResponse.data.success) {
            const goal = goalResponse.data.data;
            if (goal.current_streak >= 2) {
              testPass('Test 26: Weekly Goal - Progress Update', { streak: goal.current_streak });
            } else {
              testFail('Test 26: Weekly Goal - Progress Update', `Expected streak >= 2, got ${goal.current_streak}. Last completed: ${goal.last_completed_date}`);
            }
          } else {
            testFail('Test 26: Weekly Goal - Progress Update', JSON.stringify(goalResponse.data));
          }
        }
      } catch (error: any) {
        testFail('Test 26: Weekly Goal - Progress Update', error.message);
      }
    } else {
      testFail('Test 26: Weekly Goal - Progress Update', 'Goal ID not available');
    }

    // ==========================================
    // TEST GROUP 6: Goal Deletion & Edge Cases (Tests 27-30)
    // ==========================================
    console.log('\n--- Test Group 6: Goal Deletion & Edge Cases ---\n');

    // Test 27: Delete Goal
    // Create a goal to delete
    let goalToDeleteId: string | null = null;
    try {
      const createResponse = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Goal to Delete',
          category: 'Exercise',
          frequency: 'Daily',
        }),
      });
      if (createResponse.status === 201 && createResponse.data.success) {
        goalToDeleteId = createResponse.data.data._id;
      }
    } catch (error: any) {
      // Ignore
    }

    if (goalToDeleteId) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalToDeleteId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token1}` },
        });
        if (response.status === 200 && response.data.success) {
          // Verify it's deleted
          const getResponse = await makeRequest(`${BASE_URL}/api/v1/goals/${goalToDeleteId}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token1}` },
          });
          if (getResponse.status === 404) {
            testPass('Test 27: Delete Goal');
          } else {
            testFail('Test 27: Delete Goal', 'Goal still exists after deletion');
          }
        } else {
          testFail('Test 27: Delete Goal', JSON.stringify(response.data));
        }
      } catch (error: any) {
        testFail('Test 27: Delete Goal', error.message);
      }
    } else {
      testFail('Test 27: Delete Goal', 'Could not create goal to delete');
    }

    // Test 28: Delete Goal - Unauthorized
    if (goalId1) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/goals/${goalId1}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token2}` },
        });
        if (response.status === 403) {
          testPass('Test 28: Delete Goal - Unauthorized');
        } else {
          testFail('Test 28: Delete Goal - Unauthorized', `Expected 403, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 28: Delete Goal - Unauthorized', error.message);
      }
    } else {
      testFail('Test 28: Delete Goal - Unauthorized', 'Goal ID not available');
    }

    // Test 29: Get Goals Summary Statistics
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/goals?status=all`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token1}` },
      });
      if (response.status === 200 && response.data.success && response.data.summary) {
        if (typeof response.data.summary.active_goals === 'number' && typeof response.data.summary.total_goals === 'number') {
          testPass('Test 29: Get Goals Summary Statistics', response.data.summary);
        } else {
          testFail('Test 29: Get Goals Summary Statistics', 'Summary format incorrect');
        }
      } else {
        testFail('Test 29: Get Goals Summary Statistics', JSON.stringify(response.data));
      }
    } catch (error: any) {
      testFail('Test 29: Get Goals Summary Statistics', error.message);
    }

    // Test 30: Multiple Goals - User Isolation
    try {
      // Create goal for user2
      const user2GoalResponse = await makeRequest(`${BASE_URL}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token2}` },
        body: JSON.stringify({
          title: 'User 2 Goal',
          category: 'Exercise',
          frequency: 'Daily',
        }),
      });
      
      if (user2GoalResponse.status === 201 && user2GoalResponse.data.success) {
        const user2GoalId = user2GoalResponse.data.data._id;
        
        // User1 should not see user2's goal
        const user1GoalsResponse = await makeRequest(`${BASE_URL}/api/v1/goals`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token1}` },
        });
        
        if (user1GoalsResponse.status === 200 && user1GoalsResponse.data.success) {
          const user1HasUser2Goal = user1GoalsResponse.data.data.some((g: any) => g._id === user2GoalId);
          if (!user1HasUser2Goal) {
            testPass('Test 30: Multiple Goals - User Isolation');
          } else {
            testFail('Test 30: Multiple Goals - User Isolation', 'User1 can see user2\'s goal');
          }
        } else {
          testFail('Test 30: Multiple Goals - User Isolation', 'Failed to get user1 goals');
        }
      } else {
        testFail('Test 30: Multiple Goals - User Isolation', 'Failed to create user2 goal');
      }
    } catch (error: any) {
      testFail('Test 30: Multiple Goals - User Isolation', error.message);
    }

    // ==========================================
    // Cleanup
    // ==========================================
    console.log('\n--- Cleanup ---\n');
    try {
      // Delete test users and their data
      await GoalModel.deleteMany({ user_id: { $in: [userId1, userId2] } });
      await MoodModel.deleteMany({ user_id: { $in: [userId1, userId2] } });
      await StepsModel.deleteMany({ user_id: { $in: [userId1, userId2] } });
      await JournalModel.deleteMany({ user_id: { $in: [userId1, userId2] } });
      await UserModel.deleteMany({ _id: { $in: [userId1, userId2] } });
      console.log('✅ Cleanup completed\n');
    } catch (error: any) {
      console.log(`⚠️  Cleanup error: ${error.message}\n`);
    }

    // ==========================================
    // Test Summary
    // ==========================================
    console.log('==========================================');
    console.log('Test Summary');
    console.log('==========================================');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);
    console.log('==========================================\n');

    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`❌ ${r.name}: ${r.error}`);
      });
      console.log('');
    }

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('Database connection closed');
      }
    } catch (closeError) {
      // Ignore close errors
    }

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Test suite error:', error);
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    } catch (closeError) {
      // Ignore close errors
    }
    process.exit(1);
  }
}

testGoalsComplete();

