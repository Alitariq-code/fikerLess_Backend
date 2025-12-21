import * as http from 'http';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserSchema } from '../src/models/schemas/user.schema';

const API_BASE = 'http://localhost:5002';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

function makeRequest(
  path: string,
  options: { method?: string; body?: any; token?: string } = {},
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const method = options.method || 'GET';
    const postData = options.body ? JSON.stringify(options.body) : undefined;
    const token = options.token;

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: token }),
      },
    };

    const req = http.request(requestOptions, (res) => {
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

async function testFcmTokenEndpoint() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let authToken: string = '';

  console.log('🧪 Testing FCM Token Upsert Endpoint\n');
  console.log('='.repeat(50));

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Create test user
    console.log('📝 Creating test user...');
    const UserModel = mongoose.model('User', UserSchema);
    const email = `fcm_test_${Date.now()}@test.com`;
    const password = 'Test123456!';
    const hashedPassword = await bcrypt.hash(password, 10);

    testUser = await UserModel.create({
      email,
      password: hashedPassword,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true,
      first_name: 'FCM',
      last_name: 'Test',
    });

    console.log(`✅ Test user created: ${email}\n`);

    // Login to get token
    console.log('🔐 Logging in...');
    const loginResponse = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (loginResponse.status !== 200 || !loginResponse.data.token) {
      throw new Error('Failed to login');
    }

    authToken = loginResponse.data.token;
    console.log('✅ Login successful\n');

    // Test 1: Upsert FCM token
    console.log('Test 1: Upsert FCM token');
    const testToken1 = 'test-fcm-token-12345';
    const response1 = await makeRequest('/api/v1/notifications/fcm-token', {
      method: 'POST',
      body: { fcm_token: testToken1 },
      token: authToken,
    });

    if (response1.status === 200 && response1.data.success) {
      console.log('✅ Test 1 PASSED: FCM token saved successfully');
      console.log(`   Response: ${JSON.stringify(response1.data, null, 2)}\n`);
      results.push({ name: 'Upsert FCM token', passed: true, message: 'Token saved' });
    } else {
      console.log('❌ Test 1 FAILED');
      console.log(`   Status: ${response1.status}`);
      console.log(`   Response: ${JSON.stringify(response1.data, null, 2)}\n`);
      results.push({ name: 'Upsert FCM token', passed: false, message: JSON.stringify(response1.data) });
    }

    // Test 2: Update FCM token (upsert with new token)
    console.log('Test 2: Update FCM token (upsert)');
    const testToken2 = 'updated-fcm-token-67890';
    const response2 = await makeRequest('/api/v1/notifications/fcm-token', {
      method: 'POST',
      body: { fcm_token: testToken2 },
      token: authToken,
    });

    if (response2.status === 200 && response2.data.success && response2.data.data.fcm_token === testToken2) {
      console.log('✅ Test 2 PASSED: FCM token updated successfully');
      console.log(`   Response: ${JSON.stringify(response2.data, null, 2)}\n`);
      results.push({ name: 'Update FCM token', passed: true, message: 'Token updated' });
    } else {
      console.log('❌ Test 2 FAILED');
      console.log(`   Status: ${response2.status}`);
      console.log(`   Response: ${JSON.stringify(response2.data, null, 2)}\n`);
      results.push({ name: 'Update FCM token', passed: false, message: JSON.stringify(response2.data) });
    }

    // Test 3: Missing token (unauthorized)
    console.log('Test 3: Request without authorization token');
    const response3 = await makeRequest('/api/v1/notifications/fcm-token', {
      method: 'POST',
      body: { fcm_token: testToken1 },
    });

    if (response3.status === 401) {
      console.log('✅ Test 3 PASSED: Correctly rejected unauthorized request\n');
      results.push({ name: 'Unauthorized request', passed: true, message: 'Correctly rejected' });
    } else {
      console.log('❌ Test 3 FAILED: Should return 401\n');
      results.push({ name: 'Unauthorized request', passed: false, message: `Got ${response3.status}` });
    }

    // Test 4: Missing fcm_token in body
    console.log('Test 4: Request with missing fcm_token');
    const response4 = await makeRequest('/api/v1/notifications/fcm-token', {
      method: 'POST',
      body: {},
      token: authToken,
    });

    if (response4.status === 400) {
      console.log('✅ Test 4 PASSED: Correctly rejected invalid request\n');
      results.push({ name: 'Missing fcm_token', passed: true, message: 'Correctly rejected' });
    } else {
      console.log('⚠️  Test 4: Expected 400, got ' + response4.status);
      console.log(`   Response: ${JSON.stringify(response4.data, null, 2)}\n`);
      results.push({ name: 'Missing fcm_token', passed: false, message: `Got ${response4.status}` });
    }

  } catch (error: any) {
    console.error('❌ Test Error:', error.message);
    results.push({ name: 'Test execution', passed: false, message: error.message });
  } finally {
    // Cleanup
    if (testUser) {
      try {
        const UserModel = mongoose.model('User', UserSchema);
        await UserModel.deleteOne({ _id: testUser._id });
        console.log('🧹 Cleaned up test user\n');
      } catch (e) {
        console.log('⚠️  Could not clean up test user\n');
      }
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }

  // Summary
  console.log('='.repeat(50));
  console.log('📊 TEST SUMMARY\n');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.message}`);
  });

  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${results.length}\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Please check the output above.\n');
  }
}

// Run tests
testFcmTokenEndpoint().catch(console.error);
