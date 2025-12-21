import * as http from 'http';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { Session, SessionSchema } from '../src/models/schemas/session.schema';
import { SessionRequest, SessionRequestSchema } from '../src/models/schemas/session-request.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import { Demographics, DemographicsSchema } from '../src/models/schemas/demographics.schema';
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

async function testSessionDetailsEndpoint() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let testDoctor: any = null;
  let authToken: string = '';
  let sessionId: string = '';
  const testDate = '2025-12-25';

  console.log('🧪 Testing Session Details Endpoint\n');
  console.log('='.repeat(50));

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const UserModel = mongoose.model('User', UserSchema);
    const SessionModel = mongoose.model('Session', SessionSchema);
    const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);
    const DemographicsModel = mongoose.model('Demographics', DemographicsSchema);

    await UserModel.deleteMany({ email: /session_details_test_/ });
    await SessionModel.deleteMany({ date: testDate });

    // Create test user
    const testEmail = `session_details_test_user_${Date.now()}@test.com`;
    const testPassword = 'password123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    testUser = await UserModel.create({
      email: testEmail,
      password: hashedPassword,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true,
      first_name: 'John',
      last_name: 'Doe',
      username: 'anonymous_user_247',
    });
    console.log(`✅ Test user created: ${testUser.email}`);

    // Create demographics for user
    await DemographicsModel.create({
      user_id: testUser._id,
      preferred_language: 'English',
    });
    console.log('✅ Demographics created');

    // Create test doctor
    const doctorEmail = `session_details_test_doctor_${Date.now()}@test.com`;
    const doctorHashedPassword = await bcrypt.hash(testPassword, 10);

    testDoctor = await UserModel.create({
      email: doctorEmail,
      password: doctorHashedPassword,
      is_email_verified: true,
      user_type: 'specialist',
      has_demographics: true,
      first_name: 'Dr. Jane',
      last_name: 'Smith',
    });

    await SpecialistProfileModel.create({
      user_id: testDoctor._id,
      full_name: 'Dr. Jane Smith',
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

    // Create previous session (for last session info)
    const prevSessionRequest = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: '2025-12-20',
      start_time: '14:00',
      end_time: '15:00',
      status: 'CONFIRMED',
      amount: 100,
    });

    await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: prevSessionRequest._id,
      date: '2025-12-20',
      start_time: '14:00',
      end_time: '15:00',
      status: 'COMPLETED',
      session_type: 'video call',
      session_title: 'Previous Session',
      amount: 100,
    });

    // Create current test session
    const sessionRequest = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: testDate,
      start_time: '09:00',
      end_time: '10:00',
      status: 'CONFIRMED',
      amount: 100,
    });

    const session = await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequest._id,
      date: testDate,
      start_time: '09:00',
      end_time: '10:00',
      status: 'CONFIRMED',
      session_type: 'video call',
      session_title: 'Initial Consultation',
      session_file: '/uploads/sessions/session-1234567890-987654321.pdf',
      amount: 100,
    });
    sessionId = session._id.toString();
    console.log('✅ Test session created');

    // Test 1: Get session details
    console.log('\n🚀 Test 1: Get session details');
    const response = await makeRequest(`/api/v1/booking/sessions/${sessionId}/details`, {
      method: 'GET',
      token: authToken,
    });

    if (response.status === 200 && response.data.success) {
      const data = response.data.data;
      
      // Check session_details
      if (
        data.session_details?.session_title === 'Initial Consultation' &&
        data.session_details?.time === '09:00 - 10:00' &&
        data.session_details?.duration === '60 minutes' &&
        data.session_details?.session_type === 'video call'
      ) {
        // Check session_notes
        if (data.session_notes?.upload_documents?.file_name) {
          // Check client_information
          if (
            data.client_information?.total_sessions === 2 &&
            data.client_information?.preferred_language === 'English' &&
            data.client_information?.last_session
          ) {
            // Check doctor_information
            if (data.doctor_information?.full_name && data.doctor_information?.email) {
              results.push({ name: 'Get session details', passed: true });
              console.log('✅ Test 1 PASSED: All details retrieved correctly');
              console.log(`   Session Title: ${data.session_details.session_title}`);
              console.log(`   Duration: ${data.session_details.duration}`);
              console.log(`   Total Sessions: ${data.client_information.total_sessions}`);
              console.log(`   Preferred Language: ${data.client_information.preferred_language}`);
              console.log(`   File Name: ${data.session_notes.upload_documents.file_name}`);
            } else {
              results.push({
                name: 'Get session details (doctor info missing)',
                passed: false,
                details: 'Doctor information not populated',
              });
              console.log('❌ Test 1 FAILED: Doctor information missing');
            }
          } else {
            results.push({
              name: 'Get session details (client info incorrect)',
              passed: false,
              details: `Total sessions: ${data.client_information?.total_sessions}, Language: ${data.client_information?.preferred_language}`,
            });
            console.log('❌ Test 1 FAILED: Client information incorrect');
          }
        } else {
          results.push({
            name: 'Get session details (file info missing)',
            passed: false,
            details: 'File information not included',
          });
          console.log('❌ Test 1 FAILED: File information missing');
        }
      } else {
        results.push({
          name: 'Get session details (session details incorrect)',
          passed: false,
          details: JSON.stringify(data.session_details),
        });
        console.log('❌ Test 1 FAILED: Session details incorrect');
      }
    } else {
      results.push({
        name: 'Get session details',
        passed: false,
        details: `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`,
      });
      console.log('❌ Test 1 FAILED');
    }

    // Test 2: Get details without authentication
    console.log('\n🚀 Test 2: Get details without authentication');
    const noAuthResponse = await makeRequest(`/api/v1/booking/sessions/${sessionId}/details`, {
      method: 'GET',
    });

    if (noAuthResponse.status === 401) {
      results.push({ name: 'Get details without authentication', passed: true });
      console.log('✅ Test 2 PASSED');
    } else {
      results.push({
        name: 'Get details without authentication',
        passed: false,
        details: `Expected 401, got ${noAuthResponse.status}`,
      });
      console.log('❌ Test 2 FAILED');
    }

    // Test 3: Get details for non-existent session
    console.log('\n🚀 Test 3: Get details for non-existent session');
    const fakeSessionId = new Types.ObjectId().toString();
    const fakeResponse = await makeRequest(`/api/v1/booking/sessions/${fakeSessionId}/details`, {
      method: 'GET',
      token: authToken,
    });

    if (fakeResponse.status === 404) {
      results.push({ name: 'Get details for non-existent session', passed: true });
      console.log('✅ Test 3 PASSED');
    } else {
      results.push({
        name: 'Get details for non-existent session',
        passed: false,
        details: `Expected 404, got ${fakeResponse.status}`,
      });
      console.log('❌ Test 3 FAILED');
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
      const DemographicsModel = mongoose.model('Demographics', DemographicsSchema);

      if (testUser) {
        await SessionModel.deleteMany({ user_id: testUser._id });
        await DemographicsModel.deleteMany({ user_id: testUser._id });
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

testSessionDetailsEndpoint();

