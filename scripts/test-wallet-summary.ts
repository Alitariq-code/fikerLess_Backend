import * as http from 'http';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { Session, SessionSchema } from '../src/models/schemas/session.schema';
import { SessionRequest, SessionRequestSchema } from '../src/models/schemas/session-request.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import { Types } from 'mongoose';
import moment from 'moment-timezone';

const API_BASE = 'http://localhost:5002';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

async function makeRequest(
  path: string,
  options: { method?: string; body?: any; token?: string } = {},
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const method = options.method || 'GET';
    const postData = options.body ? JSON.stringify(options.body) : undefined;
    const token = options.token;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode || 500, data: { raw: body } });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testWalletSummaryEndpoint() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let testDoctor: any = null;
  let authToken: string = '';
  const today = moment().format('YYYY-MM-DD');
  const tomorrow = moment().add(1, 'day').format('YYYY-MM-DD');
  const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

  console.log('🧪 Testing Wallet Summary Endpoint\n');
  console.log('='.repeat(50));

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const UserModel = mongoose.model('User', UserSchema);
    const SessionModel = mongoose.model('Session', SessionSchema);
    const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);

    await UserModel.deleteMany({ email: /wallet_test_/ });
    await SessionModel.deleteMany({});

    // Create test user
    const testEmail = `wallet_test_user_${Date.now()}@test.com`;
    const testPassword = 'password123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    testUser = await UserModel.create({
      email: testEmail,
      password: hashedPassword,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true,
      first_name: 'Test',
      last_name: 'User',
    });
    console.log(`✅ Test user created: ${testUser.email}`);

    // Create test doctor
    const doctorEmail = `wallet_test_doctor_${Date.now()}@test.com`;
    const doctorHashedPassword = await bcrypt.hash(testPassword, 10);

    testDoctor = await UserModel.create({
      email: doctorEmail,
      password: doctorHashedPassword,
      is_email_verified: true,
      user_type: 'specialist',
      has_demographics: true,
      first_name: 'Test',
      last_name: 'Doctor',
    });

    await SpecialistProfileModel.create({
      user_id: testDoctor._id,
      full_name: 'Test Doctor',
      designation: 'Psychologist',
      location: 'Test Location',
      hourly_rate: 100,
      currency: 'USD',
      specializations: ['CBT'],
      languages: ['English'],
      categories: ['Anxiety & Stress Management'],
      experience_years: 5,
      education: [{ degree: 'PhD', institute_name: 'Test University' }],
      certifications: [{ certificate_title: 'Licensed', provider: 'Test Board' }],
      profile_completed: true,
    });
    console.log(`✅ Test doctor created: ${testDoctor.email}`);

    // Login
    const loginResponse = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });

    if (loginResponse.status === 200 && loginResponse.data.token) {
      authToken = `Bearer ${loginResponse.data.token}`;
      console.log('✅ Login successful');
    } else {
      results.push({ name: 'Login failed', passed: false });
      return;
    }

    // Create test sessions
    const sessionRequests = [];
    for (let i = 0; i < 3; i++) {
      const req = await SessionRequestModel.create({
        user_id: testUser._id,
        doctor_id: testDoctor._id,
        date: tomorrow,
        start_time: `${10 + i}:00`,
        end_time: `${11 + i}:00`,
        session_type: 'video',
        status: 'CONFIRMED',
        amount: 100,
      });
      sessionRequests.push(req);
    }

    // Create completed sessions (past)
    await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequests[0]._id,
      date: yesterday,
      start_time: '10:00',
      end_time: '11:00',
      status: 'COMPLETED',
      amount: 500,
    });

    await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequests[1]._id,
      date: yesterday,
      start_time: '14:00',
      end_time: '15:00',
      status: 'COMPLETED',
      amount: 300,
    });

    // Create upcoming sessions (future)
    await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequests[2]._id,
      date: tomorrow,
      start_time: '10:00',
      end_time: '11:00',
      status: 'CONFIRMED',
      amount: 200,
    });

    await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: new Types.ObjectId(),
      date: tomorrow,
      start_time: '14:00',
      end_time: '15:00',
      status: 'CONFIRMED',
      amount: 200,
    });

    console.log('✅ Created test sessions');

    // Test 1: Get wallet summary
    console.log('\n🚀 Test 1: Get wallet summary');
    const response = await makeRequest('/api/v1/booking/wallet/summary', {
      method: 'GET',
      token: authToken,
    });

    if (response.status === 200 && response.data.success) {
      const { total_earnings, upcoming_sessions } = response.data.data;
      if (total_earnings === 800 && upcoming_sessions === 2) {
        results.push({ name: 'Get wallet summary', passed: true });
        console.log('✅ Test 1 PASSED');
        console.log(`   Total Earnings: PKR ${total_earnings}`);
        console.log(`   Upcoming Sessions: ${upcoming_sessions}`);
      } else {
        results.push({
          name: 'Get wallet summary (wrong values)',
          passed: false,
          details: `Expected earnings: 800, upcoming: 2. Got earnings: ${total_earnings}, upcoming: ${upcoming_sessions}`,
        });
        console.log('❌ Test 1 FAILED: Wrong values');
      }
    } else {
      results.push({
        name: 'Get wallet summary',
        passed: false,
        details: `Status: ${response.status}`,
      });
      console.log('❌ Test 1 FAILED');
    }

    // Test 2: Without authentication
    console.log('\n🚀 Test 2: Get wallet summary without authentication');
    const response2 = await makeRequest('/api/v1/booking/wallet/summary', {
      method: 'GET',
    });

    if (response2.status === 401) {
      results.push({ name: 'Get wallet summary without authentication', passed: true });
      console.log('✅ Test 2 PASSED');
    } else {
      results.push({
        name: 'Get wallet summary without authentication',
        passed: false,
        details: `Expected 401, got ${response2.status}`,
      });
      console.log('❌ Test 2 FAILED');
    }
  } catch (error: any) {
    results.push({ name: 'Test execution', passed: false, details: error.message });
    console.log(`❌ Test Error: ${error.message}`);
  } finally {
    console.log('\n🧹 Cleaning up');
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
      await mongoose.connect(mongoUri);
      const UserModel = mongoose.model('User', UserSchema);
      const SessionModel = mongoose.model('Session', SessionSchema);

      if (testUser) {
        await SessionModel.deleteMany({ user_id: testUser._id });
        await UserModel.deleteOne({ _id: testUser._id });
      }
      if (testDoctor) {
        await UserModel.deleteOne({ _id: testDoctor._id });
      }
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    } catch (e) {
      console.log('⚠️  Cleanup error (non-critical)');
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY\n');
    let passedCount = 0;
    let failedCount = 0;
    results.forEach((result) => {
      if (result.passed) {
        console.log(`✅ ${result.name}`);
        passedCount++;
      } else {
        console.log(`❌ ${result.name}: ${result.details}`);
        failedCount++;
      }
    });
    console.log(`\n✅ Passed: ${passedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Total: ${results.length}`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  }
}

testWalletSummaryEndpoint();

