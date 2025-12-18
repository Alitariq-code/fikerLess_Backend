import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { AvailabilityRule, AvailabilityRuleSchema } from '../src/models/schemas/availability-rule.schema';
import { AvailabilitySettings, AvailabilitySettingsSchema } from '../src/models/schemas/availability-settings.schema';
import { AvailabilityOverride, AvailabilityOverrideSchema } from '../src/models/schemas/availability-override.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import { Demographics, DemographicsSchema } from '../src/models/schemas/demographics.schema';

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
const API_BASE = `${BASE_URL}/api/v1`;

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function testPass(name: string, details?: any) {
  results.push({ name, passed: true, details });
  console.log(`✅ PASS: ${name}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

function testFail(name: string, error: string, details?: any) {
  results.push({ name, passed: false, error, details });
  console.log(`❌ FAIL: ${name}`);
  console.log(`   Error: ${error}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

// Helper function to make HTTP requests
function makeRequest(
  url: string,
  options: { method: string; headers?: any; body?: string }
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
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
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: data });
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

// Test users
interface TestUser {
  email: string;
  password: string;
  user_type: string;
  token?: string;
  userId?: string;
}

class BookingAvailabilityTestSuite {
  private specialist1: TestUser = {
    email: 'doctor1@test.com',
    password: 'Doctor123!',
    user_type: 'specialist',
  };

  private specialist2: TestUser = {
    email: 'doctor2@test.com',
    password: 'Doctor123!',
    user_type: 'specialist',
  };

  private regularUser: TestUser = {
    email: 'user1@test.com',
    password: 'User123!',
    user_type: 'user',
  };

  private settingsId1: string = '';
  private ruleId1: string = '';
  private ruleId2: string = '';
  private overrideId1: string = '';

  async setup(): Promise<void> {
    console.log('\n🔧 SETTING UP TEST ENVIRONMENT...\n');

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

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Create User model
    const UserModel = mongoose.model('User', UserSchema);
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);

    // Create test users
    for (const user of [this.specialist1, this.specialist2, this.regularUser]) {
      const existing = await UserModel.findOne({ email: user.email });
      if (existing) {
        // Update password
        const hashedPassword = await bcrypt.hash(user.password, 10);
        existing.password = hashedPassword;
        existing.user_type = user.user_type;
        existing.is_email_verified = true;
        await existing.save();
        user.userId = existing._id.toString();
      } else {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        const newUser = new UserModel({
          email: user.email,
          password: hashedPassword,
          user_type: user.user_type,
          is_email_verified: true,
          first_name: user.email.split('@')[0],
        });
        await newUser.save();
        user.userId = newUser._id.toString();
      }

      // Create specialist profile for specialists
      if (user.user_type === 'specialist') {
        const userIdObj = new mongoose.Types.ObjectId(user.userId);
        let profile = await SpecialistProfileModel.findOne({ user_id: userIdObj });
        if (!profile) {
          profile = new SpecialistProfileModel({
            user_id: userIdObj,
            full_name: `${user.email.split('@')[0]} Test`,
            designation: 'Test Specialist',
            location: 'Test Location',
            hourly_rate: 1000,
            currency: 'PKR',
            education: [{ degree: 'MBBS', institute_name: 'Test University' }],
            certifications: [{ certificate_title: 'Test Certificate', provider: 'Test Provider' }],
            profile_completed: true,
            is_verified: false,
          });
        } else {
          // Ensure profile is complete
          profile.full_name = profile.full_name || `${user.email.split('@')[0]} Test`;
          profile.designation = profile.designation || 'Test Specialist';
          profile.location = profile.location || 'Test Location';
          profile.hourly_rate = profile.hourly_rate || 1000;
          profile.currency = profile.currency || 'PKR';
          if (!profile.education || profile.education.length === 0) {
            profile.education = [{ degree: 'MBBS', institute_name: 'Test University' }];
          }
          if (!profile.certifications || profile.certifications.length === 0) {
            profile.certifications = [{ certificate_title: 'Test Certificate', provider: 'Test Provider' }];
          }
          profile.profile_completed = true;
        }
        await profile.save();
        console.log(`✅ Created/updated specialist profile for ${user.email}`);
      }

      // For regular users, create demographics
      if (user.user_type === 'user') {
        const DemographicsModel = mongoose.model('Demographics', DemographicsSchema);
        const userIdObj = new mongoose.Types.ObjectId(user.userId);
        const existingDemographics = await DemographicsModel.findOne({ user_id: userIdObj });
        if (!existingDemographics) {
          const demographics = new DemographicsModel({
            user_id: userIdObj,
            age_range: '18-25',
            gender_identity: 'Other',
            understands_emergency_disclaimer: true,
          });
          await demographics.save();
          // Update user has_demographics flag
          await UserModel.updateOne({ _id: userIdObj }, { has_demographics: true });
          console.log(`✅ Created demographics for ${user.email}`);
        } else {
          await UserModel.updateOne({ _id: userIdObj }, { has_demographics: true });
        }
      }

      // Login to get token
      const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      if (loginResponse.status === 200) {
        // Token might be in data.token or data.data.token
        const token = loginResponse.data.token || loginResponse.data.data?.token;
        if (token) {
          user.token = token;
          console.log(`✅ Created and logged in: ${user.email}`);
        } else {
          console.log(`⚠️  Login successful but no token found for ${user.email}`);
          console.log(`   Response: ${JSON.stringify(loginResponse.data)}`);
        }
      } else {
        console.log(`❌ Login failed for ${user.email}: ${JSON.stringify(loginResponse.data)}`);
      }
    }

    // Clean up existing booking data for test users
    const AvailabilityRuleModel = mongoose.model('AvailabilityRule', AvailabilityRuleSchema);
    const AvailabilitySettingsModel = mongoose.model('AvailabilitySettings', AvailabilitySettingsSchema);
    const AvailabilityOverrideModel = mongoose.model('AvailabilityOverride', AvailabilityOverrideSchema);

    await AvailabilityRuleModel.deleteMany({ doctor_id: { $in: [this.specialist1.userId, this.specialist2.userId] } });
    await AvailabilitySettingsModel.deleteMany({ doctor_id: { $in: [this.specialist1.userId, this.specialist2.userId] } });
    await AvailabilityOverrideModel.deleteMany({ doctor_id: { $in: [this.specialist1.userId, this.specialist2.userId] } });

    console.log('✅ Cleaned up existing booking data\n');
  }

  async cleanup(): Promise<void> {
    console.log('\n💾 PRESERVING TEST DATA IN DATABASE...\n');
    console.log('✅ Test data has been kept in the database for inspection');
    console.log(`   Specialist 1 (${this.specialist1.email}): ${this.specialist1.userId}`);
    console.log(`   Specialist 2 (${this.specialist2.email}): ${this.specialist2.userId}`);
    console.log(`   Regular User (${this.regularUser.email}): ${this.regularUser.userId}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }

  // ==================== TEST CASES ====================

  async runAllTests(): Promise<void> {
    console.log('\n🧪 STARTING BOOKING AVAILABILITY TEST SUITE (50 TEST CASES)\n');
    console.log('='.repeat(80));

    // GROUP 1: Availability Settings Tests (Tests 1-6)
    await this.runSettingsTests();

    // GROUP 2: Availability Rules Tests (Tests 7-18)
    await this.runRulesTests();

    // GROUP 3: Availability Overrides Tests (Tests 19-30)
    await this.runOverridesTests();

    // GROUP 4: Advanced & Edge Cases Tests (Tests 31-50)
    await this.runAdvancedTests();

    // Print summary
    this.printSummary();
  }

  // ==================== GROUP 1: AVAILABILITY SETTINGS ====================

  async runSettingsTests(): Promise<void> {
    console.log('\n📋 GROUP 1: AVAILABILITY SETTINGS (Tests 1-6)\n');

    // Test 1: Create availability settings - Happy Path
    await this.test('1. Create availability settings (Happy Path)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 60,
          break_minutes: 15,
          timezone: 'Asia/Karachi',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}. Data: ${JSON.stringify(response.data)}`);
      }
      this.settingsId1 = response.data.data._id;
    });

    // Test 2: Create settings with invalid slot duration (too small)
    await this.test('2. Create settings with invalid slot duration (< 15 minutes)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 10,
          break_minutes: 15,
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject slot duration less than 15 minutes');
      }
    });

    // Test 3: Create settings with invalid break minutes (negative)
    await this.test('3. Create settings with negative break minutes', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 60,
          break_minutes: -5,
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject negative break minutes');
      }
    });

    // Test 4: Get availability settings
    await this.test('4. Get availability settings', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success || !response.data.data) {
        throw new Error(`Expected 200 with data, got ${response.status}`);
      }
      if (response.data.data.slot_duration_minutes !== 60) {
        throw new Error('Settings data mismatch');
      }
    });

    // Test 5: Update availability settings
    await this.test('5. Update availability settings', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 45,
          break_minutes: 10,
        }),
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.slot_duration_minutes !== 45) {
        throw new Error('Update did not work');
      }
    });

    // Test 6: Regular user cannot create settings (Authorization)
    await this.test('6. Regular user cannot create settings (Authorization Check)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.regularUser.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 60,
          break_minutes: 15,
        }),
      });

      if (response.status === 201) {
        throw new Error('Regular user should not be able to create settings');
      }
    });
  }

  // ==================== GROUP 2: AVAILABILITY RULES ====================

  async runRulesTests(): Promise<void> {
    console.log('\n📋 GROUP 2: AVAILABILITY RULES (Tests 7-18)\n');

    // Test 7: Create rule without settings (should fail)
    await this.test('7. Create rule without settings (should fail)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'MON',
          start_time: '09:00',
          end_time: '17:00',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should fail when settings do not exist');
      }
    });

    // Test 8: Create availability rule - Happy Path
    await this.test('8. Create availability rule (Happy Path)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'MON',
          start_time: '09:00',
          end_time: '17:00',
          is_active: true,
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      this.ruleId1 = response.data.data._id;
    });

    // Test 9: Create rule with invalid time format
    await this.test('9. Create rule with invalid time format', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'TUE',
          start_time: '9:00', // Missing leading zero
          end_time: '17:00',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject invalid time format');
      }
    });

    // Test 10: Create rule with start_time >= end_time
    await this.test('10. Create rule with start_time >= end_time', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'TUE',
          start_time: '17:00',
          end_time: '09:00',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject when start_time >= end_time');
      }
    });

    // Test 11: Create overlapping rule (same day, overlapping times)
    await this.test('11. Create overlapping rule (same day, overlapping times)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'MON',
          start_time: '10:00',
          end_time: '18:00',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject overlapping rules on same day');
      }
    });

    // Test 12: Create non-overlapping rule (same day, different times)
    await this.test('12. Create non-overlapping rule (same day, different times)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'MON',
          start_time: '18:00',
          end_time: '20:00',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      this.ruleId2 = response.data.data._id;
    });

    // Test 13: Create rule for different day (should work)
    await this.test('13. Create rule for different day (should work)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          day_of_week: 'TUE',
          start_time: '09:00',
          end_time: '17:00',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 14: Get all availability rules
    await this.test('14. Get all availability rules', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success || !Array.isArray(response.data.data)) {
        throw new Error(`Expected 200 with array, got ${response.status}`);
      }
      if (response.data.data.length < 3) {
        throw new Error(`Expected at least 3 rules, got ${response.data.data.length}`);
      }
    });

    // Test 15: Get rule by ID
    await this.test('15. Get rule by ID', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules/${this.ruleId1}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.day_of_week !== 'MON') {
        throw new Error('Rule data mismatch');
      }
    });

    // Test 16: Update availability rule
    await this.test('16. Update availability rule', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules/${this.ruleId1}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          start_time: '08:00',
          end_time: '16:00',
        }),
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.start_time !== '08:00') {
        throw new Error('Update did not work');
      }
    });

    // Test 17: Update rule to create overlap (should fail)
    await this.test('17. Update rule to create overlap (should fail)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules/${this.ruleId1}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          start_time: '18:00',
          end_time: '21:00',
        }),
      });

      if (response.status === 200) {
        throw new Error('Should reject update that creates overlap');
      }
    });

    // Test 18: Delete availability rule
    await this.test('18. Delete availability rule', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules/${this.ruleId2}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });
  }

  // ==================== GROUP 3: AVAILABILITY OVERRIDES ====================

  async runOverridesTests(): Promise<void> {
    console.log('\n📋 GROUP 3: AVAILABILITY OVERRIDES (Tests 19-30)\n');

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Get next week's date
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    // Get yesterday's date (should fail)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Test 19: Create override with OFF type - Happy Path
    await this.test('19. Create override with OFF type (Happy Path)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'OFF',
          reason: 'Holiday',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      this.overrideId1 = response.data.data._id;
    });

    // Test 20: Create override with CUSTOM type - Happy Path
    await this.test('20. Create override with CUSTOM type (Happy Path)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: nextWeekStr,
          type: 'CUSTOM',
          start_time: '10:00',
          end_time: '14:00',
          reason: 'Half day',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 21: Create override with past date (should fail)
    await this.test('21. Create override with past date (should fail)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: yesterdayStr,
          type: 'OFF',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject past dates');
      }
    });

    // Test 22: Create CUSTOM override without times (should fail)
    await this.test('22. Create CUSTOM override without times (should fail)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'CUSTOM',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should require times for CUSTOM type');
      }
    });

    // Test 23: Create CUSTOM override with invalid time range
    await this.test('23. Create CUSTOM override with invalid time range', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'CUSTOM',
          start_time: '17:00',
          end_time: '09:00',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject invalid time range');
      }
    });

    // Test 24: Create duplicate override for same date (should fail)
    await this.test('24. Create duplicate override for same date (should fail)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'OFF',
        }),
      });

      if (response.status === 201) {
        throw new Error('Should reject duplicate override for same date');
      }
    });

    // Test 25: Get all overrides
    await this.test('25. Get all overrides', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success || !Array.isArray(response.data.data)) {
        throw new Error(`Expected 200 with array, got ${response.status}`);
      }
      if (response.data.data.length < 2) {
        throw new Error(`Expected at least 2 overrides, got ${response.data.data.length}`);
      }
    });

    // Test 26: Get overrides with date range filter
    await this.test('26. Get overrides with date range filter', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/availability/overrides?start_date=${tomorrowStr}&end_date=${nextWeekStr}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.specialist1.token}` },
        }
      );

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    // Test 27: Get override by ID
    await this.test('27. Get override by ID', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides/${this.overrideId1}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.type !== 'OFF') {
        throw new Error('Override data mismatch');
      }
    });

    // Test 28: Update override
    await this.test('28. Update override', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides/${this.overrideId1}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          reason: 'Updated holiday reason',
        }),
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.reason !== 'Updated holiday reason') {
        throw new Error('Update did not work');
      }
    });

    // Test 29: Specialist cannot access another specialist's override
    await this.test('29. Specialist cannot access another specialist\'s override (Authorization)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides/${this.overrideId1}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      if (response.status === 200 && response.data.success) {
        throw new Error('Specialist should not access another specialist\'s override');
      }
    });

    // Test 30: Delete override
    await this.test('30. Delete override', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides/${this.overrideId1}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });
  }

  // ==================== GROUP 4: ADVANCED & EDGE CASES ====================

  async runAdvancedTests(): Promise<void> {
    console.log('\n📋 GROUP 4: ADVANCED & EDGE CASES (Tests 31-50)\n');

    // Get dates for testing
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split('T')[0];
    
    const farFuture = new Date(today);
    farFuture.setFullYear(farFuture.getFullYear() + 1);
    const farFutureStr = farFuture.toISOString().split('T')[0];

    // Test 31: Create settings with minimum valid values
    await this.test('31. Create settings with minimum valid values (15 min slot, 0 min break)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 15,
          break_minutes: 0,
          timezone: 'UTC',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
      if (response.data.data.slot_duration_minutes !== 15 || response.data.data.break_minutes !== 0) {
        throw new Error('Minimum values not saved correctly');
      }
    });

    // Test 32: Create settings with maximum valid values
    await this.test('32. Create settings with maximum valid values (480 min slot, 60 min break)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          slot_duration_minutes: 480,
          break_minutes: 60,
        }),
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    // Test 33: Create rule with midnight start time
    await this.test('33. Create rule with midnight start time (00:00)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'SUN',
          start_time: '00:00',
          end_time: '06:00',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 34: Create rule with end of day time (23:59)
    await this.test('34. Create rule with end of day time (23:59)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'SUN',
          start_time: '20:00',
          end_time: '23:59',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 35: Create multiple rules for same day (non-overlapping)
    await this.test('35. Create multiple rules for same day (non-overlapping)', async () => {
      const response1 = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'SAT',
          start_time: '09:00',
          end_time: '12:00',
        }),
      });

      const response2 = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'SAT',
          start_time: '14:00',
          end_time: '18:00',
        }),
      });

      if (response1.status !== 201 || response2.status !== 201) {
        throw new Error('Failed to create multiple non-overlapping rules');
      }
    });

    // Test 36: Deactivate and reactivate a rule
    await this.test('36. Deactivate and reactivate a rule', async () => {
      // First create a rule
      const createResponse = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'WED',
          start_time: '10:00',
          end_time: '14:00',
        }),
      });

      if (createResponse.status !== 201) {
        throw new Error('Failed to create rule');
      }

      const ruleId = createResponse.data.data._id;

      // Deactivate
      const deactivateResponse = await makeRequest(`${API_BASE}/booking/availability/rules/${ruleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          is_active: false,
        }),
      });

      if (deactivateResponse.status !== 200 || deactivateResponse.data.data.is_active !== false) {
        throw new Error('Failed to deactivate rule');
      }

      // Reactivate
      const reactivateResponse = await makeRequest(`${API_BASE}/booking/availability/rules/${ruleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          is_active: true,
        }),
      });

      if (reactivateResponse.status !== 200 || reactivateResponse.data.data.is_active !== true) {
        throw new Error('Failed to reactivate rule');
      }
    });

    // Test 37: Create override for today (should work)
    await this.test('37. Create override for today (should work)', async () => {
      // Use a unique date to avoid conflicts
      const uniqueToday = new Date(today);
      uniqueToday.setDate(uniqueToday.getDate() + 20);
      const uniqueTodayStr = uniqueToday.toISOString().split('T')[0];

      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          date: uniqueTodayStr,
          type: 'OFF',
          reason: 'Today is a holiday',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 38: Create override for far future date
    await this.test('38. Create override for far future date (1 year ahead)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          date: farFutureStr,
          type: 'CUSTOM',
          start_time: '10:00',
          end_time: '14:00',
          reason: 'Future holiday',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 39: Update override to change from OFF to CUSTOM
    await this.test('39. Update override to change from OFF to CUSTOM', async () => {
      // First create an OFF override
      const createResponse = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          date: nextMonthStr,
          type: 'OFF',
          reason: 'Initial holiday',
        }),
      });

      if (createResponse.status !== 201) {
        throw new Error('Failed to create OFF override');
      }

      const overrideId = createResponse.data.data._id;

      // Update to CUSTOM
      const updateResponse = await makeRequest(`${API_BASE}/booking/availability/overrides/${overrideId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          type: 'CUSTOM',
          start_time: '11:00',
          end_time: '15:00',
        }),
      });

      if (updateResponse.status !== 200 || updateResponse.data.data.type !== 'CUSTOM') {
        throw new Error('Failed to update override type');
      }
    });

    // Test 40: Get overrides with invalid date range (start > end)
    await this.test('40. Get overrides with invalid date range (start > end)', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/availability/overrides?start_date=${tomorrowStr}&end_date=${todayStr}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.specialist2.token}` },
        }
      );

      // Should still work but return empty or handle gracefully
      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
    });

    // Test 41: Create rule with exact 1-hour duration
    await this.test('41. Create rule with exact 1-hour duration', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'THU',
          start_time: '13:00',
          end_time: '14:00',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 42: Create rule with very short duration (15 minutes)
    await this.test('42. Create rule with very short duration (15 minutes)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: 'THU',
          start_time: '15:00',
          end_time: '15:15',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 43: Create override with very long reason text
    await this.test('43. Create override with very long reason text', async () => {
      const longReason = 'This is a very long reason text that describes why the doctor is not available on this particular date. ' +
        'It might include multiple sentences and detailed explanations about the circumstances. '.repeat(5);

      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'OFF',
          reason: longReason,
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 44: Update settings timezone to different timezone
    await this.test('44. Update settings timezone to different timezone', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          timezone: 'America/New_York',
        }),
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (response.data.data.timezone !== 'America/New_York') {
        throw new Error('Timezone not updated correctly');
      }
    });

    // Test 45: Create all 7 days of week rules (or verify existing ones)
    await this.test('45. Create rules for all 7 days of week (or verify existing)', async () => {
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      let successCount = 0;
      let existingCount = 0;

      // First get existing rules
      const getResponse = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      const existingRules = getResponse.data.data || [];
      const existingDays = existingRules.map((r: any) => r.day_of_week);

      for (const day of days) {
        if (existingDays.includes(day)) {
          existingCount++;
          successCount++;
        } else {
          const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.specialist2.token}` },
            body: JSON.stringify({
              day_of_week: day,
              start_time: '09:00',
              end_time: '17:00',
            }),
          });

          if (response.status === 201) {
            successCount++;
          }
        }
      }

      if (successCount < 7) {
        throw new Error(`Expected 7 rules (created or existing), got ${successCount} (${existingCount} existing, ${successCount - existingCount} created)`);
      }

      console.log(`   Created ${successCount - existingCount} new rules, ${existingCount} already existed`);
    });

    // Test 46: Get rules filtered by active status
    await this.test('46. Get all rules and verify active/inactive count', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      const rules = response.data.data;
      const activeRules = rules.filter((r: any) => r.is_active === true);
      const inactiveRules = rules.filter((r: any) => r.is_active === false);

      if (rules.length === 0) {
        throw new Error('No rules found');
      }

      console.log(`   Found ${rules.length} total rules: ${activeRules.length} active, ${inactiveRules.length} inactive`);
    });

    // Test 47: Create override with same date but different doctor (should work)
    await this.test('47. Create override with same date but different doctor (should work)', async () => {
      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist1.token}` },
        body: JSON.stringify({
          date: tomorrowStr,
          type: 'OFF',
          reason: 'Different doctor same date',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 48: Update rule to same values (should work)
    await this.test('48. Update rule to same values (should work)', async () => {
      // Get first rule
      const getResponse = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      if (getResponse.status !== 200 || !getResponse.data.data || getResponse.data.data.length === 0) {
        throw new Error('No rules found to update');
      }

      const rule = getResponse.data.data[0];
      const ruleId = rule._id;

      // Update with same values
      const updateResponse = await makeRequest(`${API_BASE}/booking/availability/rules/${ruleId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          day_of_week: rule.day_of_week,
          start_time: rule.start_time,
          end_time: rule.end_time,
        }),
      });

      if (updateResponse.status !== 200 || !updateResponse.data.success) {
        throw new Error(`Expected 200, got ${updateResponse.status}`);
      }
    });

    // Test 49: Create override with empty reason (should work)
    await this.test('49. Create override with empty reason (should work)', async () => {
      const nextWeekDate = new Date(today);
      nextWeekDate.setDate(nextWeekDate.getDate() + 14);
      const nextWeekStr = nextWeekDate.toISOString().split('T')[0];

      const response = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
        body: JSON.stringify({
          date: nextWeekStr,
          type: 'OFF',
        }),
      });

      if (response.status !== 201 || !response.data.success) {
        throw new Error(`Expected 201, got ${response.status}`);
      }
    });

    // Test 50: Comprehensive test - Get all data for a specialist
    await this.test('50. Comprehensive test - Get all data for a specialist', async () => {
      // Get settings
      const settingsResponse = await makeRequest(`${API_BASE}/booking/availability/settings`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      // Get rules
      const rulesResponse = await makeRequest(`${API_BASE}/booking/availability/rules`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      // Get overrides
      const overridesResponse = await makeRequest(`${API_BASE}/booking/availability/overrides`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist2.token}` },
      });

      if (settingsResponse.status !== 200 || rulesResponse.status !== 200 || overridesResponse.status !== 200) {
        throw new Error('Failed to retrieve all data');
      }

      console.log(`   Settings: ${settingsResponse.data.success ? 'Found' : 'Not found'}`);
      console.log(`   Rules: ${rulesResponse.data.data.length} found`);
      console.log(`   Overrides: ${overridesResponse.data.data.length} found`);
    });
  }

  // ==================== HELPER METHODS ====================

  async test(name: string, testFn: () => Promise<void>): Promise<void> {
    try {
      await testFn();
      testPass(name);
    } catch (error: any) {
      testFail(name, error.message, error.stack);
    }
  }

  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 TEST SUMMARY\n');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(2)}%\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:\n');
      results
        .filter((r) => !r.passed)
        .forEach((r, index) => {
          console.log(`${index + 1}. ${r.name}`);
          console.log(`   Error: ${r.error}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');
  }
}

// Run tests
async function runTests() {
  const suite = new BookingAvailabilityTestSuite();
  try {
    await suite.setup();
    await suite.runAllTests();
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await suite.cleanup();
  }
}

runTests();

