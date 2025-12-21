import * as http from 'http';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { Session, SessionSchema } from '../src/models/schemas/session.schema';
import { SessionRequest, SessionRequestSchema } from '../src/models/schemas/session-request.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import { Types } from 'mongoose';

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

async function testSessionsByDateEndpoint() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let testDoctor: any = null;
  let authToken: string = '';
  let doctorToken: string = '';
  const testDate = '2025-12-25';

  console.log('🧪 Testing Sessions By Date Endpoint\n');
  console.log('='.repeat(50));

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const UserModel = mongoose.model('User', UserSchema);
    const SessionModel = mongoose.model('Session', SessionSchema);
    const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);

    // Clean up previous test data
    await UserModel.deleteMany({ email: /sessions_test_/ });
    await SessionModel.deleteMany({ date: testDate });

    // 1. Create test user
    console.log('\n📝 Creating test user...');
    const testEmail = `sessions_test_user_${Date.now()}@test.com`;
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

    // 2. Create test doctor
    console.log('\n📝 Creating test doctor...');
    const doctorEmail = `sessions_test_doctor_${Date.now()}@test.com`;
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
    console.log(`✅ Test doctor created: ${testDoctor.email}`);

    // Create specialist profile for doctor (required for login)
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);
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
      education: [
        {
          degree: 'PhD',
          institute_name: 'Test University',
        },
      ],
      certifications: [
        {
          certificate_title: 'Licensed Psychologist',
          provider: 'Test Board',
        },
      ],
      profile_completed: true,
    });
    console.log(`✅ Specialist profile created for doctor`);

    // 3. Login test user
    console.log('\n🔐 Logging in user...');
    const loginResponse = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });

    if (loginResponse.status === 200 && loginResponse.data.token) {
      authToken = `Bearer ${loginResponse.data.token}`;
      results.push({ name: 'User login successful', passed: true });
      console.log('✅ User login successful');
    } else {
      results.push({
        name: 'User login failed',
        passed: false,
        details: `Status: ${loginResponse.status}, Response: ${JSON.stringify(loginResponse.data)}`,
      });
      console.log('❌ User login failed');
      return;
    }

    // 4. Login test doctor
    console.log('\n🔐 Logging in doctor...');
    const doctorLoginResponse = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: doctorEmail, password: testPassword },
    });

    if (doctorLoginResponse.status === 200 && doctorLoginResponse.data.token) {
      doctorToken = `Bearer ${doctorLoginResponse.data.token}`;
      results.push({ name: 'Doctor login successful', passed: true });
      console.log('✅ Doctor login successful');
    } else {
      results.push({
        name: 'Doctor login failed',
        passed: false,
        details: `Status: ${doctorLoginResponse.status}`,
      });
      console.log('❌ Doctor login failed');
      return;
    }

    // 5. Create test sessions
    console.log('\n📅 Creating test sessions...');
    
    // Create a dummy session request first (required for sessions)
    const sessionRequest1 = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: testDate,
      start_time: '10:00',
      end_time: '11:00',
      session_type: 'video',
      status: 'CONFIRMED',
      amount: 100,
    });

    const sessionRequest2 = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: testDate,
      start_time: '14:00',
      end_time: '15:00',
      session_type: 'video',
      status: 'CONFIRMED',
      amount: 100,
    });

    const sessionRequest3 = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: testDate,
      start_time: '16:00',
      end_time: '17:00',
      session_type: 'video',
      status: 'CONFIRMED',
      amount: 100,
    });

    const session1 = await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequest1._id,
      date: testDate,
      start_time: '10:00',
      end_time: '11:00',
      status: 'CONFIRMED',
      session_type: 'video',
      amount: 100,
    });

    const session2 = await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequest2._id,
      date: testDate,
      start_time: '14:00',
      end_time: '15:00',
      status: 'COMPLETED',
      session_type: 'video',
      amount: 100,
    });

    const session3 = await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequest3._id,
      date: testDate,
      start_time: '16:00',
      end_time: '17:00',
      status: 'CANCELLED',
      session_type: 'video',
      amount: 100,
    });

    console.log('✅ Created 3 test sessions');

    // Test 1: Get sessions by date without status filter
    console.log('\n🚀 Test 1: Get sessions by date (no status filter)');
    const response1 = await makeRequest(`/api/v1/booking/sessions/by-date?date=${testDate}`, {
      method: 'GET',
      token: authToken,
    });

    if (response1.status === 200 && response1.data.success && Array.isArray(response1.data.data)) {
      const sessions = response1.data.data;
      if (sessions.length === 3) {
        // Check if user_id and doctor_id are populated
        const firstSession = sessions[0];
        if (
          firstSession.user_id &&
          typeof firstSession.user_id === 'object' &&
          firstSession.user_id.first_name &&
          firstSession.doctor_id &&
          typeof firstSession.doctor_id === 'object' &&
          firstSession.doctor_id.first_name
        ) {
          results.push({ name: 'Get sessions by date (no status filter)', passed: true });
          console.log('✅ Test 1 PASSED: All sessions retrieved with populated user and doctor');
          console.log(`   Found ${sessions.length} sessions`);
          console.log(`   User populated: ${firstSession.user_id.first_name} ${firstSession.user_id.last_name}`);
          console.log(`   Doctor populated: ${firstSession.doctor_id.first_name} ${firstSession.doctor_id.last_name}`);
        } else {
          results.push({
            name: 'Get sessions by date (populated fields missing)',
            passed: false,
            details: `User or doctor not populated correctly`,
          });
          console.log('❌ Test 1 FAILED: User or doctor not populated');
        }
      } else {
        results.push({
          name: 'Get sessions by date (wrong count)',
          passed: false,
          details: `Expected 3 sessions, got ${sessions.length}`,
        });
        console.log(`❌ Test 1 FAILED: Expected 3 sessions, got ${sessions.length}`);
      }
    } else {
      results.push({
        name: 'Get sessions by date (no status filter)',
        passed: false,
        details: `Status: ${response1.status}, Response: ${JSON.stringify(response1.data)}`,
      });
      console.log('❌ Test 1 FAILED');
    }

    // Test 2: Get sessions by date with status filter (CONFIRMED)
    console.log('\n🚀 Test 2: Get sessions by date with status filter (CONFIRMED)');
    const response2 = await makeRequest(
      `/api/v1/booking/sessions/by-date?date=${testDate}&status=CONFIRMED`,
      {
        method: 'GET',
        token: authToken,
      },
    );

    if (response2.status === 200 && response2.data.success && Array.isArray(response2.data.data)) {
      const sessions = response2.data.data;
      if (sessions.length === 1 && sessions[0].status === 'CONFIRMED') {
        const session = sessions[0];
        if (
          session.user_id &&
          typeof session.user_id === 'object' &&
          session.user_id.first_name &&
          session.doctor_id &&
          typeof session.doctor_id === 'object' &&
          session.doctor_id.first_name
        ) {
          results.push({ name: 'Get sessions by date with status filter (CONFIRMED)', passed: true });
          console.log('✅ Test 2 PASSED: Filtered sessions retrieved correctly');
          console.log(`   Found ${sessions.length} CONFIRMED session`);
        } else {
          results.push({
            name: 'Get sessions by date with status filter (populated fields missing)',
            passed: false,
            details: `User or doctor not populated correctly`,
          });
          console.log('❌ Test 2 FAILED: User or doctor not populated');
        }
      } else {
        results.push({
          name: 'Get sessions by date with status filter (CONFIRMED)',
          passed: false,
          details: `Expected 1 CONFIRMED session, got ${sessions.length}`,
        });
        console.log(`❌ Test 2 FAILED: Expected 1 CONFIRMED session, got ${sessions.length}`);
      }
    } else {
      results.push({
        name: 'Get sessions by date with status filter (CONFIRMED)',
        passed: false,
        details: `Status: ${response2.status}, Response: ${JSON.stringify(response2.data)}`,
      });
      console.log('❌ Test 2 FAILED');
    }

    // Test 3: Get sessions by date with status filter (COMPLETED)
    console.log('\n🚀 Test 3: Get sessions by date with status filter (COMPLETED)');
    const response3 = await makeRequest(
      `/api/v1/booking/sessions/by-date?date=${testDate}&status=COMPLETED`,
      {
        method: 'GET',
        token: authToken,
      },
    );

    if (response3.status === 200 && response3.data.success && Array.isArray(response3.data.data)) {
      const sessions = response3.data.data;
      if (sessions.length === 1 && sessions[0].status === 'COMPLETED') {
        results.push({ name: 'Get sessions by date with status filter (COMPLETED)', passed: true });
        console.log('✅ Test 3 PASSED: Filtered COMPLETED sessions retrieved correctly');
        console.log(`   Found ${sessions.length} COMPLETED session`);
      } else {
        results.push({
          name: 'Get sessions by date with status filter (COMPLETED)',
          passed: false,
          details: `Expected 1 COMPLETED session, got ${sessions.length}`,
        });
        console.log(`❌ Test 3 FAILED: Expected 1 COMPLETED session, got ${sessions.length}`);
      }
    } else {
      results.push({
        name: 'Get sessions by date with status filter (COMPLETED)',
        passed: false,
        details: `Status: ${response3.status}, Response: ${JSON.stringify(response3.data)}`,
      });
      console.log('❌ Test 3 FAILED');
    }

    // Test 4: Get sessions by date without date parameter (should return all sessions)
    console.log('\n🚀 Test 4: Get sessions by date without date parameter (should return all sessions)');
    const response4 = await makeRequest('/api/v1/booking/sessions/by-date', {
      method: 'GET',
      token: authToken,
    });

    if (response4.status === 200 && response4.data.success && Array.isArray(response4.data.data)) {
      const sessions = response4.data.data;
      if (sessions.length >= 3) { // Should return at least the 3 sessions we created
        results.push({ name: 'Get sessions by date without date parameter (should return all sessions)', passed: true });
        console.log('✅ Test 4 PASSED: Correctly returned all sessions without date parameter');
        console.log(`   Found ${sessions.length} sessions`);
      } else {
        results.push({
          name: 'Get sessions by date without date parameter (wrong count)',
          passed: false,
          details: `Expected at least 3 sessions, got ${sessions.length}`,
        });
        console.log(`❌ Test 4 FAILED: Expected at least 3 sessions, got ${sessions.length}`);
      }
    } else {
      results.push({
        name: 'Get sessions by date without date parameter (should return all sessions)',
        passed: false,
        details: `Status: ${response4.status}, Response: ${JSON.stringify(response4.data)}`,
      });
      console.log('❌ Test 4 FAILED');
    }

    // Test 5: Get sessions by date without authentication (should fail)
    console.log('\n🚀 Test 5: Get sessions by date without authentication (should fail)');
    const response5 = await makeRequest(`/api/v1/booking/sessions/by-date?date=${testDate}`, {
      method: 'GET',
    });

    if (response5.status === 401) {
      results.push({ name: 'Get sessions by date without authentication (should fail)', passed: true });
      console.log('✅ Test 5 PASSED: Correctly rejected unauthenticated request');
    } else {
      results.push({
        name: 'Get sessions by date without authentication (should fail)',
        passed: false,
        details: `Expected 401, got ${response5.status}`,
      });
      console.log(`❌ Test 5 FAILED: Expected 401, got ${response5.status}`);
    }

    // Test 6: Get sessions by date with invalid date format (should fail)
    console.log('\n🚀 Test 6: Get sessions by date with invalid date format (should fail)');
    const response6 = await makeRequest('/api/v1/booking/sessions/by-date?date=invalid-date', {
      method: 'GET',
      token: authToken,
    });

    if (response6.status === 400) {
      results.push({ name: 'Get sessions by date with invalid date format (should fail)', passed: true });
      console.log('✅ Test 6 PASSED: Correctly rejected invalid date format');
    } else {
      results.push({
        name: 'Get sessions by date with invalid date format (should fail)',
        passed: false,
        details: `Expected 400, got ${response6.status}`,
      });
      console.log(`❌ Test 6 FAILED: Expected 400, got ${response6.status}`);
    }

    // Test 8: Get all sessions with status filter only (no date)
    console.log('\n🚀 Test 8: Get all sessions with status filter only (no date)');
    const response8 = await makeRequest('/api/v1/booking/sessions/by-date?status=CONFIRMED', {
      method: 'GET',
      token: authToken,
    });

    if (response8.status === 200 && response8.data.success && Array.isArray(response8.data.data)) {
      const sessions = response8.data.data;
      // Should return all CONFIRMED sessions across all dates
      const allConfirmed = sessions.every(s => s.status === 'CONFIRMED');
      if (allConfirmed) {
        results.push({ name: 'Get all sessions with status filter only (no date)', passed: true });
        console.log('✅ Test 8 PASSED: Correctly returned all CONFIRMED sessions');
        console.log(`   Found ${sessions.length} CONFIRMED sessions`);
      } else {
        results.push({
          name: 'Get all sessions with status filter only (wrong status)',
          passed: false,
          details: `Not all sessions have CONFIRMED status`,
        });
        console.log('❌ Test 8 FAILED: Not all sessions have CONFIRMED status');
      }
    } else {
      results.push({
        name: 'Get all sessions with status filter only (no date)',
        passed: false,
        details: `Status: ${response8.status}, Response: ${JSON.stringify(response8.data)}`,
      });
      console.log('❌ Test 8 FAILED');
    }

    // Test 7: Get sessions by date for different date (should return empty)
    console.log('\n🚀 Test 7: Get sessions by date for different date (should return empty)');
    const response7 = await makeRequest('/api/v1/booking/sessions/by-date?date=2025-12-26', {
      method: 'GET',
      token: authToken,
    });

    if (response7.status === 200 && response7.data.success && Array.isArray(response7.data.data)) {
      const sessions = response7.data.data;
      if (sessions.length === 0) {
        results.push({ name: 'Get sessions by date for different date (should return empty)', passed: true });
        console.log('✅ Test 7 PASSED: Correctly returned empty array for different date');
      } else {
        results.push({
          name: 'Get sessions by date for different date (should return empty)',
          passed: false,
          details: `Expected 0 sessions, got ${sessions.length}`,
        });
        console.log(`❌ Test 7 FAILED: Expected 0 sessions, got ${sessions.length}`);
      }
    } else {
      results.push({
        name: 'Get sessions by date for different date (should return empty)',
        passed: false,
        details: `Status: ${response7.status}, Response: ${JSON.stringify(response7.data)}`,
      });
      console.log('❌ Test 7 FAILED');
    }
  } catch (error: any) {
    results.push({ name: 'Test execution', passed: false, details: error.message });
    console.log(`❌ Test Error: ${error.message}`);
  } finally {
    // Clean up
    console.log('\n🧹 Cleaning up test data');
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
      console.log('\n⚠️  Some tests failed. Please check the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    }
  }
}

testSessionsByDateEndpoint();

