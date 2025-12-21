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
      port: url.port || 5002,
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

async function testNotificationSettings() {
  const results: TestResult[] = [];
  let testUser: any = null;
  let authToken: string = '';

  console.log('🧪 Testing Notification Settings Endpoints\n');
  console.log('='.repeat(50));

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Create test user
    console.log('📝 Creating test user...');
    const UserModel = mongoose.model('User', UserSchema);
    const email = `notif_settings_test_${Date.now()}@test.com`;
    const password = 'Test123456!';
    const hashedPassword = await bcrypt.hash(password, 10);

    testUser = await UserModel.create({
      email,
      password: hashedPassword,
      is_email_verified: true,
      user_type: 'user',
      has_demographics: true,
      first_name: 'Settings',
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

    // Test 1: Get settings (should create defaults)
    console.log('Test 1: Get notification settings (should create defaults)');
    const response1 = await makeRequest('/api/v1/notifications/settings', {
      method: 'GET',
      token: authToken,
    });

    if (response1.status === 200 && response1.data.success && response1.data.data) {
      const settings = response1.data.data;
      console.log('✅ Test 1 PASSED: Settings retrieved');
      console.log(`   Email: ${settings.email_notifications}`);
      console.log(`   SMS: ${settings.sms_notifications}`);
      console.log(`   Appointments: ${settings.appointment_reminders}`);
      console.log(`   Payments: ${settings.payment_notifications}\n`);
      results.push({ name: 'Get settings', passed: true, message: 'Settings retrieved' });
    } else {
      console.log('❌ Test 1 FAILED');
      console.log(`   Status: ${response1.status}`);
      console.log(`   Response: ${JSON.stringify(response1.data, null, 2)}\n`);
      results.push({ name: 'Get settings', passed: false, message: JSON.stringify(response1.data) });
    }

    // Test 2: Update settings
    console.log('Test 2: Update notification settings');
    const updateData = {
      email_notifications: false,
      sms_notifications: true,
      appointment_reminders: false,
      payment_notifications: true,
    };
    const response2 = await makeRequest('/api/v1/notifications/settings', {
      method: 'PATCH',
      body: updateData,
      token: authToken,
    });

    if (response2.status === 200 && response2.data.success) {
      const updated = response2.data.data;
      if (
        updated.email_notifications === false &&
        updated.sms_notifications === true &&
        updated.appointment_reminders === false &&
        updated.payment_notifications === true
      ) {
        console.log('✅ Test 2 PASSED: Settings updated correctly');
        console.log(`   Updated values match expected\n`);
        results.push({ name: 'Update settings', passed: true, message: 'Settings updated' });
      } else {
        console.log('❌ Test 2 FAILED: Values do not match');
        console.log(`   Response: ${JSON.stringify(updated, null, 2)}\n`);
        results.push({ name: 'Update settings', passed: false, message: 'Values mismatch' });
      }
    } else {
      console.log('❌ Test 2 FAILED');
      console.log(`   Status: ${response2.status}`);
      console.log(`   Response: ${JSON.stringify(response2.data, null, 2)}\n`);
      results.push({ name: 'Update settings', passed: false, message: JSON.stringify(response2.data) });
    }

    // Test 3: Partial update
    console.log('Test 3: Partial update (only email_notifications)');
    const response3 = await makeRequest('/api/v1/notifications/settings', {
      method: 'PATCH',
      body: { email_notifications: true },
      token: authToken,
    });

    if (response3.status === 200 && response3.data.success && response3.data.data.email_notifications === true) {
      console.log('✅ Test 3 PASSED: Partial update works\n');
      results.push({ name: 'Partial update', passed: true, message: 'Partial update successful' });
    } else {
      console.log('❌ Test 3 FAILED');
      console.log(`   Status: ${response3.status}`);
      console.log(`   Response: ${JSON.stringify(response3.data, null, 2)}\n`);
      results.push({ name: 'Partial update', passed: false, message: JSON.stringify(response3.data) });
    }

    // Test 4: Unauthorized request
    console.log('Test 4: Request without authorization token');
    const response4 = await makeRequest('/api/v1/notifications/settings', {
      method: 'GET',
    });

    if (response4.status === 401) {
      console.log('✅ Test 4 PASSED: Correctly rejected unauthorized request\n');
      results.push({ name: 'Unauthorized request', passed: true, message: 'Correctly rejected' });
    } else {
      console.log('❌ Test 4 FAILED: Should return 401\n');
      results.push({ name: 'Unauthorized request', passed: false, message: `Got ${response4.status}` });
    }

    // Test 5: Verify settings persist
    console.log('Test 5: Verify settings persist after update');
    const response5 = await makeRequest('/api/v1/notifications/settings', {
      method: 'GET',
      token: authToken,
    });

    if (response5.status === 200 && response5.data.success) {
      const settings = response5.data.data;
      if (settings.email_notifications === true) {
        console.log('✅ Test 5 PASSED: Settings persist correctly\n');
        results.push({ name: 'Settings persistence', passed: true, message: 'Settings persist' });
      } else {
        console.log('❌ Test 5 FAILED: Settings did not persist\n');
        results.push({ name: 'Settings persistence', passed: false, message: 'Settings not persisted' });
      }
    } else {
      console.log('❌ Test 5 FAILED\n');
      results.push({ name: 'Settings persistence', passed: false, message: 'Could not retrieve settings' });
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
testNotificationSettings().catch(console.error);

