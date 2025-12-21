import * as http from 'http';
import * as fs from 'fs';
import { basename, extname, join } from 'path';
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
  options: { method?: string; body?: any; token?: string; filePath?: string } = {},
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const method = options.method || 'GET';
    const token = options.token;

    if (options.filePath) {
      // File upload request
      const boundary = '----WebKitFormBoundary' + Date.now();
      const fileContent = fs.readFileSync(options.filePath);
      const fileName = basename(options.filePath as string);
      const fileExt = extname(fileName).toLowerCase();

      let body = Buffer.alloc(0);
      body = Buffer.concat([
        body,
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`),
        Buffer.from(`Content-Type: ${fileExt === '.pdf' ? 'application/pdf' : fileExt === '.doc' || fileExt === '.docx' ? 'application/msword' : 'text/plain'}\r\n\r\n`),
        fileContent,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
          ...(token && { Authorization: token }),
        },
      };

      const req = http.request(reqOptions, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            resolve({ status: res.statusCode || 500, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode || 500, data: { raw: responseBody } });
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    } else {
      // Regular JSON request
      const postData = options.body ? JSON.stringify(options.body) : undefined;

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
    }
  });
}

async function testSessionFileUpload() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let testDoctor: any = null;
  let authToken: string = '';
  let sessionId: string = '';
  const testDate = '2025-12-25';

  console.log('🧪 Testing Session File Upload Endpoint\n');
  console.log('='.repeat(50));

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const UserModel = mongoose.model('User', UserSchema);
    const SessionModel = mongoose.model('Session', SessionSchema);
    const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);

    await UserModel.deleteMany({ email: /session_file_test_/ });
    await SessionModel.deleteMany({ date: testDate });

    // Create test user
    const testEmail = `session_file_test_user_${Date.now()}@test.com`;
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
    const doctorEmail = `session_file_test_doctor_${Date.now()}@test.com`;
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

    // Create test session
    const sessionRequest = await SessionRequestModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      date: testDate,
      start_time: '10:00',
      end_time: '11:00',
      status: 'CONFIRMED',
      amount: 100,
    });

    const session = await SessionModel.create({
      user_id: testUser._id,
      doctor_id: testDoctor._id,
      session_request_id: sessionRequest._id,
      date: testDate,
      start_time: '10:00',
      end_time: '11:00',
      status: 'CONFIRMED',
      session_type: 'video call',
      amount: 100,
    });
    sessionId = session._id.toString();
    console.log('✅ Test session created');

    // Create a test file
    const testFileContent = 'This is a test PDF content for session file upload';
    const testFilePath = join(__dirname, 'test-session-file.txt');
    fs.writeFileSync(testFilePath, testFileContent);
    console.log('✅ Test file created');

    // Test 1: Upload file
    console.log('\n🚀 Test 1: Upload session file');
    const uploadResponse = await makeRequest(`/api/v1/booking/sessions/${sessionId}/upload-file`, {
      method: 'POST',
      token: authToken,
      filePath: testFilePath,
    });

    if (uploadResponse.status === 200 && uploadResponse.data.success) {
      const updatedSession = await SessionModel.findById(sessionId);
      if (updatedSession && updatedSession.session_file) {
        results.push({ name: 'Upload session file', passed: true });
        console.log('✅ Test 1 PASSED: File uploaded successfully');
        console.log(`   File URL: ${updatedSession.session_file}`);
      } else {
        results.push({
          name: 'Upload session file (file not saved)',
          passed: false,
          details: 'File URL not found in session',
        });
        console.log('❌ Test 1 FAILED: File not saved in session');
      }
    } else {
      results.push({
        name: 'Upload session file',
        passed: false,
        details: `Status: ${uploadResponse.status}, Response: ${JSON.stringify(uploadResponse.data)}`,
      });
      console.log('❌ Test 1 FAILED');
    }

    // Test 2: Upload without authentication
    console.log('\n🚀 Test 2: Upload without authentication');
    const noAuthResponse = await makeRequest(`/api/v1/booking/sessions/${sessionId}/upload-file`, {
      method: 'POST',
      filePath: testFilePath,
    });

    if (noAuthResponse.status === 401) {
      results.push({ name: 'Upload without authentication', passed: true });
      console.log('✅ Test 2 PASSED');
    } else {
      results.push({
        name: 'Upload without authentication',
        passed: false,
        details: `Expected 401, got ${noAuthResponse.status}`,
      });
      console.log('❌ Test 2 FAILED');
    }

    // Test 3: Upload to non-existent session
    console.log('\n🚀 Test 3: Upload to non-existent session');
    const fakeSessionId = new Types.ObjectId().toString();
    const fakeResponse = await makeRequest(`/api/v1/booking/sessions/${fakeSessionId}/upload-file`, {
      method: 'POST',
      token: authToken,
      filePath: testFilePath,
    });

    if (fakeResponse.status === 404) {
      results.push({ name: 'Upload to non-existent session', passed: true });
      console.log('✅ Test 3 PASSED');
    } else {
      results.push({
        name: 'Upload to non-existent session',
        passed: false,
        details: `Expected 404, got ${fakeResponse.status}`,
      });
      console.log('❌ Test 3 FAILED');
    }

    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
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

testSessionFileUpload();

