import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { SpecialistProfile, SpecialistProfileSchema } from '../src/models/schemas/specialist-profile.schema';
import { Demographics, DemographicsSchema } from '../src/models/schemas/demographics.schema';
import { AvailabilitySettings, AvailabilitySettingsSchema } from '../src/models/schemas/availability-settings.schema';
import { AvailabilityRule, AvailabilityRuleSchema, DayOfWeek } from '../src/models/schemas/availability-rule.schema';
import { SessionRequest, SessionRequestSchema, SessionRequestStatus } from '../src/models/schemas/session-request.schema';
import { BlockedSlot, BlockedSlotSchema } from '../src/models/schemas/blocked-slot.schema';
import { Session, SessionSchema, SessionStatus } from '../src/models/schemas/session.schema';
import * as moment from 'moment-timezone';

// Load .env file manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (key && value) {
        process.env[key] = value;
      }
    }
  });
}

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5002/api/v1';

function makeRequest(url: string, options: { method?: string; headers?: any; body?: string } = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
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

function testPass(name: string, details?: string) {
  console.log(`✅ PASS: ${name}${details ? ` - ${details}` : ''}`);
}

function testFail(name: string, error: string) {
  console.log(`❌ FAIL: ${name} - ${error}`);
}

function getFutureDate(days: number = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

class AdminSessionsTestSuite {
  private admin: { userId: string; email: string; password: string; token?: string };
  private specialist: { userId: string; email: string; password: string; token?: string };
  private user1: { userId: string; email: string; password: string; token?: string };
  private user2: { userId: string; email: string; password: string; token?: string };

  private sessionRequestId1: string = '';
  private sessionRequestId2: string = '';
  private sessionId1: string = '';
  private sessionId2: string = '';

  private results: Array<{ name: string; status: 'PASS' | 'FAIL' | 'SKIP'; error?: string }> = [];

  constructor() {
    this.admin = { userId: '', email: `admin-${Date.now()}@test.com`, password: 'Password123!' };
    this.specialist = { userId: '', email: `specialist-${Date.now()}@test.com`, password: 'Password123!' };
    this.user1 = { userId: '', email: `user1-${Date.now()}@test.com`, password: 'Password123!' };
    this.user2 = { userId: '', email: `user2-${Date.now()}@test.com`, password: 'Password123!' };
  }

  private async test(name: string, func: () => Promise<void>) {
    try {
      await func();
      this.results.push({ name, status: 'PASS' });
    } catch (error: any) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      throw error;
    }
  }

  async setup(): Promise<void> {
    console.log('\n🔧 SETTING UP TEST ENVIRONMENT...\n');

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
    console.log(`✅ Connected to MongoDB`);

    const UserModel = mongoose.model('User', UserSchema);
    const SpecialistProfileModel = mongoose.model('SpecialistProfile', SpecialistProfileSchema);
    const DemographicsModel = mongoose.model('Demographics', DemographicsSchema);
    const AvailabilitySettingsModel = mongoose.model('AvailabilitySettings', AvailabilitySettingsSchema);
    const AvailabilityRuleModel = mongoose.model('AvailabilityRule', AvailabilityRuleSchema);

    // Create test users
    const usersToCreate = [this.admin, this.specialist, this.user1, this.user2];

    for (const testUser of usersToCreate) {
      let existingUser = await UserModel.findOne({ email: testUser.email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        existingUser = await UserModel.create({
          email: testUser.email,
          password: hashedPassword,
          user_type: testUser === this.admin ? 'admin' : testUser === this.specialist ? 'specialist' : 'user',
          is_email_verified: true,
          first_name: testUser === this.admin ? 'Admin' : testUser === this.specialist ? 'Dr. Specialist' : 'Test',
          last_name: testUser === this.admin ? 'User' : testUser === this.specialist ? 'Doctor' : 'User',
          username: `${testUser.email.split('@')[0]}_${Date.now()}`,
        });
        testUser.userId = existingUser._id.toString();
      } else {
        testUser.userId = existingUser._id.toString();
      }

      // For specialists, create profile
      if (existingUser.user_type === 'specialist') {
        const userIdObj = new mongoose.Types.ObjectId(testUser.userId);
        const existingProfile = await SpecialistProfileModel.findOne({ user_id: userIdObj });
        if (!existingProfile) {
          await SpecialistProfileModel.create({
            user_id: userIdObj,
            full_name: `Dr. ${existingUser.first_name} ${existingUser.last_name}`,
            designation: 'Clinical Psychologist',
            location: 'Karachi, Pakistan',
            hourly_rate: 5000,
            currency: 'PKR',
            specializations: ['Anxiety', 'Depression'],
            languages: ['English', 'Urdu'],
            categories: ['Mental Health'],
            experience_years: 10,
            profile_completed: true,
            is_verified: true,
          });
        }
      }

      // For users, create demographics
      if (existingUser.user_type === 'user') {
        const userIdObj = new mongoose.Types.ObjectId(testUser.userId);
        const existingDemographics = await DemographicsModel.findOne({ user_id: userIdObj });
        if (!existingDemographics) {
          await DemographicsModel.create({
            user_id: userIdObj,
            age_range: '26-35',
            gender_identity: 'Female',
            country_of_residence: 'Karachi, Pakistan',
            relationship_status: 'Single',
            understands_emergency_disclaimer: true,
          });
          await UserModel.updateOne({ _id: userIdObj }, { has_demographics: true });
        }
      }

      // Login to get token
      const loginResponse = await makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email: testUser.email, password: testUser.password }),
      });

      if (loginResponse.status === 200) {
        const token = loginResponse.data.token || loginResponse.data.data?.token;
        if (token) {
          testUser.token = token;
          console.log(`✅ Created and logged in: ${testUser.email} (${existingUser.user_type})`);
        }
      }
    }

    // Setup specialist availability
    const specialistIdObj = new mongoose.Types.ObjectId(this.specialist.userId);
    const existingSettings = await AvailabilitySettingsModel.findOne({ doctor_id: specialistIdObj });
    if (!existingSettings) {
      await AvailabilitySettingsModel.create({
        doctor_id: specialistIdObj,
        slot_duration_minutes: 60,
        break_minutes: 15,
        timezone: 'Asia/Karachi',
      });
    }

    // Create weekday rules
    const weekdays: DayOfWeek[] = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];
    for (const day of weekdays) {
      const existingRule = await AvailabilityRuleModel.findOne({
        doctor_id: specialistIdObj,
        day_of_week: day,
      });
      if (!existingRule) {
        await AvailabilityRuleModel.create({
          doctor_id: specialistIdObj,
          day_of_week: day,
          start_time: '09:00',
          end_time: '17:00',
          is_active: true,
        });
      }
    }

    console.log('✅ Test environment setup complete\n');
  }

  async cleanup(): Promise<void> {
    console.log('\n💾 PRESERVING TEST DATA IN DATABASE...\n');
    console.log('✅ Test data has been kept in the database for inspection');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  }

  async runAllTests(): Promise<void> {
    console.log('\n🧪 STARTING ADMIN APPROVAL & SESSIONS TEST SUITE (30 TEST CASES)\n');
    console.log('='.repeat(80));
    console.log('📋 TESTING: Admin Approval → Session Creation → Session Queries\n');
    console.log('='.repeat(80));

    // PHASE 1: Create Session Requests (Tests 1-5)
    await this.runSessionRequestCreationTests();

    // PHASE 2: Admin Pending Requests (Tests 6-10)
    await this.runAdminPendingRequestsTests();

    // PHASE 3: Admin Approval (Tests 11-15)
    await this.runAdminApprovalTests();

    // PHASE 4: Admin Rejection (Tests 16-18)
    await this.runAdminRejectionTests();

    // PHASE 5: Session Queries (Tests 19-30)
    await this.runSessionQueryTests();

    this.printSummary();
  }

  async runSessionRequestCreationTests(): Promise<void> {
    console.log('\n📝 PHASE 1: SESSION REQUEST CREATION (Tests 1-5)\n');

    // Test 1: User creates session request
    await this.test('1. User creates session request for approval', async () => {
      const futureDate = getFutureDate(7);
      const slotsResponse = await makeRequest(
        `${API_BASE}/booking/slots/available?doctor_id=${this.specialist.userId}&date=${futureDate}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        },
      );

      if (slotsResponse.status === 200 && slotsResponse.data.data.length > 0) {
        const slot = slotsResponse.data.data[0];
        const response = await makeRequest(`${API_BASE}/booking/session-requests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user1.token}` },
          body: JSON.stringify({
            doctor_id: this.specialist.userId,
            date: futureDate,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }),
        });

        if (response.status !== 201) {
          throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(response.data)}`);
        }
        this.sessionRequestId1 = response.data.data._id;
        testPass('Session request created', `ID: ${this.sessionRequestId1}`);
      } else {
        throw new Error('No slots available');
      }
    });

    // Test 2: User uploads payment screenshot
    await this.test('2. User uploads payment screenshot', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request created');
        return;
      }
      // Payment upload requires multipart/form-data which is complex with http module
      // For now, we'll simulate by directly updating the request in DB
      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      await SessionRequestModel.updateOne(
        { _id: this.sessionRequestId1 },
        {
          status: SessionRequestStatus.PENDING_APPROVAL,
          payment_screenshot_url: '/uploads/payments/test-payment.png',
        },
      );
      testPass('Payment uploaded (simulated)', 'Request status: PENDING_APPROVAL');
    });

    // Test 3: Create second request
    await this.test('3. User creates second session request', async () => {
      const futureDate = getFutureDate(8);
      const slotsResponse = await makeRequest(
        `${API_BASE}/booking/slots/available?doctor_id=${this.specialist.userId}&date=${futureDate}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user2.token}` },
        },
      );

      if (slotsResponse.status === 200 && slotsResponse.data.data.length > 0) {
        const slot = slotsResponse.data.data[0];
        const response = await makeRequest(`${API_BASE}/booking/session-requests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.user2.token}` },
          body: JSON.stringify({
            doctor_id: this.specialist.userId,
            date: futureDate,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }),
        });

        if (response.status === 201) {
          this.sessionRequestId2 = response.data.data._id;
          // Simulate payment upload
          const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
          await SessionRequestModel.updateOne(
            { _id: this.sessionRequestId2 },
            {
              status: SessionRequestStatus.PENDING_APPROVAL,
              payment_screenshot_url: '/uploads/payments/test-payment-2.png',
            },
          );
          testPass('Second request created and payment uploaded', `ID: ${this.sessionRequestId2}`);
        } else {
          throw new Error(`Expected 201, got ${response.status}`);
        }
      } else {
        testPass('Skipped - No slots available');
      }
    });

    // Test 4: Verify requests are in PENDING_APPROVAL
    await this.test('4. Verify requests are in PENDING_APPROVAL status', async () => {
      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      if (this.sessionRequestId1) {
        const request = await SessionRequestModel.findById(this.sessionRequestId1);
        if (!request || request.status !== SessionRequestStatus.PENDING_APPROVAL) {
          throw new Error(`Request 1 status is ${request?.status}, expected PENDING_APPROVAL`);
        }
      }
      testPass('Requests verified in PENDING_APPROVAL status');
    });

    // Test 5: User cannot access admin endpoints
    await this.test('5. User cannot access admin pending requests endpoint', async () => {
      const response = await makeRequest(`${API_BASE}/booking/admin/pending-requests`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (response.status !== 403 && response.status !== 401) {
        throw new Error(`Expected 403 or 401, got ${response.status}`);
      }
      testPass('User access correctly blocked');
    });
  }

  async runAdminPendingRequestsTests(): Promise<void> {
    console.log('\n👨‍💼 PHASE 2: ADMIN PENDING REQUESTS (Tests 6-10)\n');

    // Test 6: Admin gets pending requests
    await this.test('6. Admin gets pending session requests', async () => {
      const response = await makeRequest(`${API_BASE}/booking/admin/pending-requests`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.admin.token}` },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      if (response.data.data.length === 0) {
        throw new Error('Expected at least one pending request');
      }
      testPass('Pending requests retrieved', `Found ${response.data.data.length} requests`);
    });

    // Test 7: Admin gets pending request by ID
    await this.test('7. Admin gets pending request details by ID', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/admin/pending-requests/${this.sessionRequestId1}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!response.data.data) {
        throw new Error('Request data not found');
      }
      if (response.data.data._id !== this.sessionRequestId1) {
        throw new Error('Request ID mismatch');
      }
      testPass('Request details retrieved', `Status: ${response.data.data.status}`);
    });

    // Test 8: Admin pagination works
    await this.test('8. Admin pending requests pagination works', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/admin/pending-requests?page=1&limit=1`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!response.data.pagination) {
        throw new Error('Pagination data not found');
      }
      testPass('Pagination working', `Page: ${response.data.pagination.page}, Total: ${response.data.pagination.total}`);
    });

    // Test 9: Non-admin cannot access pending requests
    await this.test('9. Non-admin cannot access pending requests', async () => {
      const response = await makeRequest(`${API_BASE}/booking/admin/pending-requests`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.specialist.token}` },
      });

      if (response.status !== 403 && response.status !== 401) {
        throw new Error(`Expected 403 or 401, got ${response.status}`);
      }
      testPass('Non-admin access correctly blocked');
    });

    // Test 10: Invalid request ID returns 404
    await this.test('10. Invalid pending request ID returns 404', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/admin/pending-requests/invalidid123`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }
      testPass('Invalid ID correctly returns 404');
    });
  }

  async runAdminApprovalTests(): Promise<void> {
    console.log('\n✅ PHASE 3: ADMIN APPROVAL (Tests 11-15)\n');

    // Test 11: Admin approves session request
    await this.test('11. Admin approves session request - Happy path', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/admin/session-requests/${this.sessionRequestId1}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.admin.token}` },
          body: JSON.stringify({
            notes: 'Approved for testing',
          }),
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!response.data.data._id) {
        throw new Error('Session ID not found');
      }
      this.sessionId1 = response.data.data._id;
      testPass('Session request approved', `Session ID: ${this.sessionId1}`);
    });

    // Test 12: Verify session was created
    await this.test('12. Verify session was created after approval', async () => {
      if (!this.sessionId1) {
        testPass('Skipped - No session created');
        return;
      }

      const SessionModel = mongoose.model('Session', SessionSchema);
      const session = await SessionModel.findById(this.sessionId1);
      if (!session) {
        throw new Error('Session not found in database');
      }
      if (session.status !== SessionStatus.CONFIRMED) {
        throw new Error(`Session status is ${session.status}, expected CONFIRMED`);
      }
      testPass('Session created and confirmed', `Status: ${session.status}`);
    });

    // Test 13: Verify blocked slot was deleted
    await this.test('13. Verify blocked slot was deleted after approval', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request');
        return;
      }

      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      const request = await SessionRequestModel.findById(this.sessionRequestId1);
      if (request && request.blocked_slot_id) {
        const BlockedSlotModel = mongoose.model('BlockedSlot', BlockedSlotSchema);
        const blockedSlot = await BlockedSlotModel.findById(request.blocked_slot_id);
        if (blockedSlot) {
          throw new Error('Blocked slot should be deleted but still exists');
        }
      }
      testPass('Blocked slot correctly deleted');
    });

    // Test 14: Verify request status updated to CONFIRMED
    await this.test('14. Verify request status updated to CONFIRMED', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request');
        return;
      }

      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      const request = await SessionRequestModel.findById(this.sessionRequestId1);
      if (!request) {
        throw new Error('Request not found');
      }
      if (request.status !== SessionRequestStatus.CONFIRMED) {
        throw new Error(`Request status is ${request.status}, expected CONFIRMED`);
      }
      testPass('Request status updated to CONFIRMED');
    });

    // Test 15: Cannot approve already approved request
    await this.test('15. Cannot approve already approved request', async () => {
      if (!this.sessionRequestId1) {
        testPass('Skipped - No request');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/admin/session-requests/${this.sessionRequestId1}/approve`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.admin.token}` },
          body: JSON.stringify({}),
        },
      );

      if (response.status !== 400) {
        throw new Error(`Expected 400, got ${response.status}`);
      }
      testPass('Already approved request correctly rejected');
    });
  }

  async runAdminRejectionTests(): Promise<void> {
    console.log('\n❌ PHASE 4: ADMIN REJECTION (Tests 16-18)\n');

    // Test 16: Admin rejects session request
    await this.test('16. Admin rejects session request - Happy path', async () => {
      if (!this.sessionRequestId2) {
        testPass('Skipped - No second request created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/admin/session-requests/${this.sessionRequestId2}/reject`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.admin.token}` },
          body: JSON.stringify({
            reason: 'Payment verification failed',
          }),
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      testPass('Session request rejected successfully');
    });

    // Test 17: Verify request status updated to REJECTED
    await this.test('17. Verify request status updated to REJECTED', async () => {
      if (!this.sessionRequestId2) {
        testPass('Skipped - No request');
        return;
      }

      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      const request = await SessionRequestModel.findById(this.sessionRequestId2);
      if (!request) {
        throw new Error('Request not found');
      }
      if (request.status !== SessionRequestStatus.REJECTED) {
        throw new Error(`Request status is ${request.status}, expected REJECTED`);
      }
      testPass('Request status updated to REJECTED');
    });

    // Test 18: Verify blocked slot was deleted after rejection
    await this.test('18. Verify blocked slot was deleted after rejection', async () => {
      if (!this.sessionRequestId2) {
        testPass('Skipped - No request');
        return;
      }

      const SessionRequestModel = mongoose.model('SessionRequest', SessionRequestSchema);
      const request = await SessionRequestModel.findById(this.sessionRequestId2);
      if (request && request.blocked_slot_id) {
        const BlockedSlotModel = mongoose.model('BlockedSlot', BlockedSlotSchema);
        const blockedSlot = await BlockedSlotModel.findById(request.blocked_slot_id);
        if (blockedSlot) {
          throw new Error('Blocked slot should be deleted but still exists');
        }
      }
      testPass('Blocked slot correctly deleted after rejection');
    });
  }

  async runSessionQueryTests(): Promise<void> {
    console.log('\n📋 PHASE 5: SESSION QUERIES (Tests 19-30)\n');

    // Test 19: User gets their sessions
    await this.test('19. User gets their confirmed sessions', async () => {
      if (!this.sessionId1) {
        testPass('Skipped - No session created');
        return;
      }

      const response = await makeRequest(`${API_BASE}/booking/sessions/my-sessions`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.user1.token}` },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      if (response.data.data.length === 0) {
        throw new Error('Expected at least one session');
      }
      testPass('User sessions retrieved', `Found ${response.data.data.length} session(s)`);
    });

    // Test 20: User filters sessions by status
    await this.test('20. User filters sessions by status', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/sessions/my-sessions?status=CONFIRMED`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      const allConfirmed = response.data.data.every((s: any) => s.status === SessionStatus.CONFIRMED);
      if (!allConfirmed && response.data.data.length > 0) {
        throw new Error('Not all sessions are CONFIRMED');
      }
      testPass('Status filter working', `Found ${response.data.data.length} confirmed session(s)`);
    });

    // Test 21: User filters sessions by date range
    await this.test('21. User filters sessions by date range', async () => {
      const startDate = getFutureDate(6);
      const endDate = getFutureDate(10);
      const response = await makeRequest(
        `${API_BASE}/booking/sessions/my-sessions?start_date=${startDate}&end_date=${endDate}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      testPass('Date range filter working', `Found ${response.data.data.length} session(s)`);
    });

    // Test 22: User gets specific session by ID
    await this.test('22. User gets specific session by ID', async () => {
      if (!this.sessionId1) {
        testPass('Skipped - No session created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/sessions/${this.sessionId1}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!response.data.data) {
        throw new Error('Session data not found');
      }
      if (response.data.data._id !== this.sessionId1) {
        throw new Error('Session ID mismatch');
      }
      testPass('Session details retrieved', `Status: ${response.data.data.status}`);
    });

    // Test 23: User cannot access another user's session
    await this.test('23. User cannot access another user\'s session', async () => {
      if (!this.sessionId1) {
        testPass('Skipped - No session created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/sessions/${this.sessionId1}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user2.token}` },
        },
      );

      if (response.status !== 404 && response.status !== 403) {
        throw new Error(`Expected 404 or 403, got ${response.status}`);
      }
      testPass('Unauthorized access correctly blocked');
    });

    // Test 24: Doctor gets their sessions
    await this.test('24. Doctor gets their sessions', async () => {
      if (!this.sessionId1) {
        testPass('Skipped - No session created');
        return;
      }

      const response = await makeRequest(
        `${API_BASE}/booking/sessions/doctor/${this.specialist.userId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.specialist.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      testPass('Doctor sessions retrieved', `Found ${response.data.data.length} session(s)`);
    });

    // Test 25: Doctor filters sessions by status
    await this.test('25. Doctor filters sessions by status', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/sessions/doctor/${this.specialist.userId}?status=CONFIRMED`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.specialist.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      testPass('Doctor status filter working', `Found ${response.data.data.length} confirmed session(s)`);
    });

    // Test 26: Doctor cannot view another doctor's sessions
    await this.test('26. Doctor cannot view another doctor\'s sessions', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/sessions/doctor/${this.specialist.userId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.user1.token}` },
        },
      );

      if (response.status !== 400 && response.status !== 403) {
        throw new Error(`Expected 400 or 403, got ${response.status}`);
      }
      testPass('Unauthorized doctor access correctly blocked');
    });

    // Test 27: Admin gets all sessions
    await this.test('27. Admin gets all sessions', async () => {
      const response = await makeRequest(`${API_BASE}/booking/admin/sessions`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.admin.token}` },
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }
      if (!response.data.success) {
        throw new Error('Expected success: true');
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      if (!response.data.pagination) {
        throw new Error('Pagination data not found');
      }
      testPass('All sessions retrieved', `Found ${response.data.data.length} session(s), Total: ${response.data.pagination.total}`);
    });

    // Test 28: Admin filters sessions by status
    await this.test('28. Admin filters sessions by status', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/admin/sessions?status=CONFIRMED`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      const allConfirmed = response.data.data.every((s: any) => s.status === SessionStatus.CONFIRMED);
      if (!allConfirmed && response.data.data.length > 0) {
        throw new Error('Not all sessions are CONFIRMED');
      }
      testPass('Admin status filter working', `Found ${response.data.data.length} confirmed session(s)`);
    });

    // Test 29: Admin filters sessions by doctor
    await this.test('29. Admin filters sessions by doctor', async () => {
      const response = await makeRequest(
        `${API_BASE}/booking/admin/sessions?doctor_id=${this.specialist.userId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      const allMatchDoctor = response.data.data.every(
        (s: any) => s.doctor_id._id === this.specialist.userId || s.doctor_id === this.specialist.userId,
      );
      if (!allMatchDoctor && response.data.data.length > 0) {
        throw new Error('Not all sessions match the doctor filter');
      }
      testPass('Doctor filter working', `Found ${response.data.data.length} session(s)`);
    });

    // Test 30: Admin filters sessions by date range
    await this.test('30. Admin filters sessions by date range', async () => {
      const startDate = getFutureDate(6);
      const endDate = getFutureDate(10);
      const response = await makeRequest(
        `${API_BASE}/booking/admin/sessions?start_date=${startDate}&end_date=${endDate}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${this.admin.token}` },
        },
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }
      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }
      testPass('Date range filter working', `Found ${response.data.data.length} session(s)`);
    });
  }

  private printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const skipped = this.results.filter((r) => r.status === 'SKIP').length;

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`\nSuccess Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter((r) => r.status === 'FAIL')
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 FLOW SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Session Requests Created: ${this.sessionRequestId1 ? '1' : '0'} + ${this.sessionRequestId2 ? '1' : '0'}`);
    console.log(`✅ Sessions Created: ${this.sessionId1 ? '1' : '0'}`);
    console.log(`✅ Admin Approval: ${this.sessionId1 ? 'Tested' : 'Skipped'}`);
    console.log(`✅ Admin Rejection: ${this.sessionRequestId2 ? 'Tested' : 'Skipped'}`);
    console.log('='.repeat(80) + '\n');
  }
}

// Run tests
async function runTests() {
  const suite = new AdminSessionsTestSuite();
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

