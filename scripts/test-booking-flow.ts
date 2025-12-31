import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema, User, UserDocument } from '../src/models/schemas/user.schema';
import { SpecialistProfileSchema, SpecialistProfile, SpecialistProfileDocument } from '../src/models/schemas/specialist-profile.schema';
import { SessionRequestSchema, SessionRequest, SessionRequestDocument, SessionRequestStatus } from '../src/models/schemas/session-request.schema';
import { SessionSchema, Session, SessionDocument, SessionStatus } from '../src/models/schemas/session.schema';
import { DemographicsSchema, Demographics, DemographicsDocument } from '../src/models/schemas/demographics.schema';
import { generateUniqueUsername } from '../src/utils/utils';

async function testBookingFlow() {
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

    // Create models
    const UserModel = mongoose.model<UserDocument>('User', UserSchema);
    const SpecialistProfileModel = mongoose.model<SpecialistProfileDocument>('SpecialistProfile', SpecialistProfileSchema);
    const SessionRequestModel = mongoose.model<SessionRequestDocument>('SessionRequest', SessionRequestSchema);
    const SessionModel = mongoose.model<SessionDocument>('Session', SessionSchema);
    const DemographicsModel = mongoose.model<DemographicsDocument>('Demographics', DemographicsSchema);

    // Step 1: Create dummy users
    console.log('📝 Step 1: Creating dummy users...\n');

    // Create regular user 1
    const user1Email = 'booking-user1@fikrless.com';
    const user1Password = 'Test@123';
    let user1 = await UserModel.findOne({ email: user1Email }).exec();
    
    if (user1) {
      console.log('ℹ️  User 1 already exists, updating...');
      user1.is_email_verified = true;
      user1.has_demographics = true;
      const hashedPassword1 = await bcrypt.hash(user1Password, 10);
      user1.password = hashedPassword1;
      await user1.save();
    } else {
      const hashedPassword1 = await bcrypt.hash(user1Password, 10);
      const user1Username = await generateUniqueUsername('Booking', 'User1', user1Email, UserModel);
      
      user1 = new UserModel({
        email: user1Email,
        password: hashedPassword1,
        user_type: 'user',
        is_email_verified: true,
        has_demographics: true,
        username: user1Username,
        first_name: 'Booking',
        last_name: 'User1',
        otp_token: '',
      });
      await user1.save();
    }

    // Create demographics for user1
    let demographics1 = await DemographicsModel.findOne({ user_id: user1._id }).exec();
    if (!demographics1) {
      demographics1 = new DemographicsModel({
        user_id: user1._id,
        age: 25,
        gender: 'Male',
        preferred_language: 'English',
      });
      await demographics1.save();
    }

    console.log(`✅ User 1 created/updated:`);
    console.log(`   ID: ${user1._id}`);
    console.log(`   Email: ${user1Email}`);
    console.log(`   Password: ${user1Password}`);
    console.log(`   Email Verified: ${user1.is_email_verified}`);
    console.log(`   Has Demographics: ${user1.has_demographics}\n`);

    // Create regular user 2
    const user2Email = 'booking-user2@fikrless.com';
    const user2Password = 'Test@123';
    let user2 = await UserModel.findOne({ email: user2Email }).exec();
    
    if (user2) {
      console.log('ℹ️  User 2 already exists, updating...');
      user2.is_email_verified = true;
      user2.has_demographics = true;
      const hashedPassword2 = await bcrypt.hash(user2Password, 10);
      user2.password = hashedPassword2;
      await user2.save();
    } else {
      const hashedPassword2 = await bcrypt.hash(user2Password, 10);
      const user2Username = await generateUniqueUsername('Booking', 'User2', user2Email, UserModel);
      
      user2 = new UserModel({
        email: user2Email,
        password: hashedPassword2,
        user_type: 'user',
        is_email_verified: true,
        has_demographics: true,
        username: user2Username,
        first_name: 'Booking',
        last_name: 'User2',
        otp_token: '',
      });
      await user2.save();
    }

    // Create demographics for user2
    let demographics2 = await DemographicsModel.findOne({ user_id: user2._id }).exec();
    if (!demographics2) {
      demographics2 = new DemographicsModel({
        user_id: user2._id,
        age: 30,
        gender: 'Female',
        preferred_language: 'English',
      });
      await demographics2.save();
    }

    console.log(`✅ User 2 created/updated:`);
    console.log(`   ID: ${user2._id}`);
    console.log(`   Email: ${user2Email}`);
    console.log(`   Password: ${user2Password}\n`);

    // Create specialist/doctor
    const doctorEmail = 'booking-doctor@fikrless.com';
    const doctorPassword = 'Test@123';
    let doctor = await UserModel.findOne({ email: doctorEmail }).exec();
    
    if (doctor) {
      console.log('ℹ️  Doctor already exists, updating...');
      doctor.is_email_verified = true;
      const hashedPasswordDoctor = await bcrypt.hash(doctorPassword, 10);
      doctor.password = hashedPasswordDoctor;
      await doctor.save();
    } else {
      const hashedPasswordDoctor = await bcrypt.hash(doctorPassword, 10);
      const doctorUsername = await generateUniqueUsername('Dr', 'Test', doctorEmail, UserModel);
      
      doctor = new UserModel({
        email: doctorEmail,
        password: hashedPasswordDoctor,
        user_type: 'specialist',
        is_email_verified: true,
        username: doctorUsername,
        first_name: 'Dr',
        last_name: 'Test',
        otp_token: '',
      });
      await doctor.save();
    }

    // Create specialist profile
    let specialistProfile = await SpecialistProfileModel.findOne({ user_id: doctor._id }).exec();
    if (!specialistProfile) {
      specialistProfile = new SpecialistProfileModel({
        user_id: doctor._id,
        full_name: 'Dr. Test Specialist',
        designation: 'Licensed Clinical Psychologist',
        location: 'Test Location',
        hourly_rate: 5000,
        currency: 'PKR',
        specializations: ['Anxiety', 'Depression'],
        languages: ['English'],
        categories: ['Mental Health'],
        profile_photo: '',
        is_verified: true,
        about: 'Test specialist for booking flow',
      });
      await specialistProfile.save();
    }

    console.log(`✅ Doctor created/updated:`);
    console.log(`   ID: ${doctor._id}`);
    console.log(`   Email: ${doctorEmail}`);
    console.log(`   Password: ${doctorPassword}\n`);

    // Step 2: Create session requests
    console.log('📝 Step 2: Creating session requests...\n');

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];

    // Create session request 1 (pending payment)
    let sessionRequest1 = await SessionRequestModel.findOne({ 
      user_id: user1._id,
      date: tomorrowDateStr,
    }).exec();

    if (!sessionRequest1) {
      sessionRequest1 = new SessionRequestModel({
        doctor_id: doctor._id,
        user_id: user1._id,
        date: tomorrowDateStr,
        start_time: '10:00',
        end_time: '11:00',
        amount: 5000,
        currency: 'PKR',
        status: SessionRequestStatus.PENDING_PAYMENT,
        session_title: 'Initial Consultation',
        session_type: 'video call',
      });
      await sessionRequest1.save();
      console.log(`✅ Session Request 1 created (PENDING_PAYMENT):`);
      console.log(`   ID: ${sessionRequest1._id}`);
      console.log(`   Date: ${tomorrowDateStr}`);
      console.log(`   Time: 10:00 - 11:00`);
      console.log(`   Amount: 5000 PKR\n`);
    } else {
      console.log(`ℹ️  Session Request 1 already exists: ${sessionRequest1._id}\n`);
    }

    // Create session request 2 (pending approval - with payment)
    // Use a different time slot to avoid conflicts with existing sessions
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowDateStr = dayAfterTomorrow.toISOString().split('T')[0];

    // Check if there's an existing session for this slot and delete it if needed
    const existingSession = await SessionModel.findOne({
      doctor_id: doctor._id,
      date: dayAfterTomorrowDateStr,
      start_time: '14:00',
    }).exec();

    if (existingSession) {
      console.log(`ℹ️  Found existing session for this slot, deleting it...`);
      await SessionModel.findByIdAndDelete(existingSession._id);
      console.log(`✅ Existing session deleted\n`);
    }

    let sessionRequest2 = await SessionRequestModel.findOne({ 
      user_id: user2._id,
      date: dayAfterTomorrowDateStr,
      start_time: '14:00',
    }).exec();

    if (!sessionRequest2) {
      sessionRequest2 = new SessionRequestModel({
        doctor_id: doctor._id,
        user_id: user2._id,
        date: dayAfterTomorrowDateStr,
        start_time: '14:00',
        end_time: '15:00',
        amount: 6000,
        currency: 'PKR',
        status: SessionRequestStatus.PENDING_APPROVAL,
        payment_screenshot_url: '/uploads/payments/test-payment.jpg',
        session_title: 'Follow-up Session',
        session_type: 'audio call',
      });
      await sessionRequest2.save();
      console.log(`✅ Session Request 2 created (PENDING_APPROVAL):`);
      console.log(`   ID: ${sessionRequest2._id}`);
      console.log(`   Date: ${dayAfterTomorrowDateStr}`);
      console.log(`   Time: 14:00 - 15:00`);
      console.log(`   Amount: 6000 PKR`);
      console.log(`   Payment: Uploaded\n`);
    } else {
      // Reset status to PENDING_APPROVAL if it was already approved
      if (sessionRequest2.status !== SessionRequestStatus.PENDING_APPROVAL) {
        sessionRequest2.status = SessionRequestStatus.PENDING_APPROVAL;
        sessionRequest2.payment_screenshot_url = '/uploads/payments/test-payment.jpg';
        await sessionRequest2.save();
        console.log(`ℹ️  Session Request 2 reset to PENDING_APPROVAL: ${sessionRequest2._id}\n`);
      } else {
        console.log(`ℹ️  Session Request 2 already exists in PENDING_APPROVAL: ${sessionRequest2._id}\n`);
      }
    }

    // Step 3: Test API endpoints
    console.log('📝 Step 3: Testing API endpoints...\n');
    const BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5002';

    // Login as admin
    console.log('🔐 Logging in as admin...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@fikrless.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    
    const adminLoginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
      }),
    });
    
    const adminLoginData = await adminLoginResponse.json();
    
    if (!adminLoginResponse.ok || !adminLoginData.token) {
      console.log('⚠️  Admin login failed. Creating admin user...');
      // Try to create admin if doesn't exist
      const adminUser = await UserModel.findOne({ email: adminEmail }).exec();
      if (!adminUser) {
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        const adminUsername = await generateUniqueUsername('Admin', 'User', adminEmail, UserModel);
        const newAdmin = new UserModel({
          email: adminEmail,
          password: hashedAdminPassword,
          user_type: 'admin',
          is_email_verified: true,
          username: adminUsername,
          first_name: 'Admin',
          last_name: 'User',
          otp_token: '',
        });
        await newAdmin.save();
        console.log('✅ Admin user created');
      }
      throw new Error('Please run npm run create:admin first to create admin user');
    }
    
    const adminToken = adminLoginData.token;
    console.log('✅ Logged in as admin\n');

    // Test 1: Get pending session requests
    console.log('📋 Test 1: Getting pending session requests...');
    const pendingRequestsResponse = await fetch(`${BASE_URL}/api/v1/booking/admin/pending-requests?page=1&limit=10`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    
    const pendingRequestsData = await pendingRequestsResponse.json();
    if (pendingRequestsData.success) {
      console.log(`✅ Found ${pendingRequestsData.data?.length || 0} pending requests`);
      if (pendingRequestsData.data && pendingRequestsData.data.length > 0) {
        pendingRequestsData.data.forEach((req: any, index: number) => {
          console.log(`   ${index + 1}. Request ID: ${req._id}`);
          console.log(`      Status: ${req.status}`);
          console.log(`      Date: ${req.date}`);
        });
      }
    } else {
      console.log('❌ Failed to get pending requests');
    }
    console.log('');

    // Test 2: Approve session request 2
    // Refresh sessionRequest2 to get latest status
    sessionRequest2 = await SessionRequestModel.findById(sessionRequest2._id).exec();
    
    if (sessionRequest2 && sessionRequest2.status === SessionRequestStatus.PENDING_APPROVAL) {
      console.log('📋 Test 2: Approving session request 2...');
      const approveResponse = await fetch(`${BASE_URL}/api/v1/booking/admin/session-requests/${sessionRequest2._id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Approved by test script',
        }),
      });
      
      const approveData = await approveResponse.json();
      if (approveData.success) {
        console.log('✅ Session request approved successfully!');
        // The response structure: data contains the session object
        const sessionId = approveData.data?._id || 
                         approveData.data?.session?._id || 
                         approveData.session_id || 
                         'N/A';
        const sessionStatus = approveData.data?.status || 
                              approveData.data?.session?.status || 
                              'N/A';
        console.log(`   Session ID: ${sessionId}`);
        console.log(`   Status: ${sessionStatus}`);
        if (approveData.data) {
          console.log(`   Date: ${approveData.data.date || 'N/A'}`);
          console.log(`   Time: ${approveData.data.start_time || 'N/A'} - ${approveData.data.end_time || 'N/A'}`);
        }
      } else {
        console.log('❌ Failed to approve session request');
        console.log(`   Error: ${approveData.message || JSON.stringify(approveData)}`);
      }
      console.log('');
    } else {
      console.log(`ℹ️  Session Request 2 is not in PENDING_APPROVAL status (current: ${sessionRequest2?.status}), skipping approval test`);
      console.log('');
    }

    // Test 3: Get all sessions
    console.log('📋 Test 3: Getting all sessions...');
    const sessionsResponse = await fetch(`${BASE_URL}/api/v1/booking/admin/sessions?page=1&limit=10`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` },
    });
    
    const sessionsData = await sessionsResponse.json();
    if (sessionsData.success) {
      console.log(`✅ Found ${sessionsData.data?.length || 0} sessions`);
      if (sessionsData.data && sessionsData.data.length > 0) {
        sessionsData.data.forEach((session: any, index: number) => {
          console.log(`   ${index + 1}. Session ID: ${session._id}`);
          console.log(`      Status: ${session.status}`);
          console.log(`      Date: ${session.date}`);
          console.log(`      Time: ${session.start_time} - ${session.end_time}`);
        });
      }
    } else {
      console.log('❌ Failed to get sessions');
    }
    console.log('');

    // Test 4: Update session status to COMPLETED
    if (sessionsData.success && sessionsData.data && sessionsData.data.length > 0) {
      const confirmedSession = sessionsData.data.find((s: any) => s.status === 'CONFIRMED');
      if (confirmedSession) {
        console.log('📋 Test 4: Updating session status to COMPLETED...');
        const updateStatusResponse = await fetch(`${BASE_URL}/api/v1/booking/admin/sessions/${confirmedSession._id}/status`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            notes: 'Session completed successfully - test script',
          }),
        });
        
        const updateStatusData = await updateStatusResponse.json();
        if (updateStatusData.success) {
          console.log('✅ Session status updated to COMPLETED!');
          console.log(`   Session ID: ${updateStatusData.data?._id || 'N/A'}`);
          console.log(`   New Status: ${updateStatusData.data?.status || 'N/A'}`);
        } else {
          console.log('❌ Failed to update session status');
          console.log(`   Error: ${updateStatusData.message || JSON.stringify(updateStatusData)}`);
        }
        console.log('');
      } else {
        console.log('ℹ️  No CONFIRMED sessions found to update');
        console.log('');
      }
    }

    // Summary
    console.log('='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Regular User 1: ${user1Email}`);
    console.log(`  - User ID: ${user1._id}`);
    console.log(`  - Password: ${user1Password}`);
    console.log(`\nRegular User 2: ${user2Email}`);
    console.log(`  - User ID: ${user2._id}`);
    console.log(`  - Password: ${user2Password}`);
    console.log(`\nDoctor/Specialist: ${doctorEmail}`);
    console.log(`  - User ID: ${doctor._id}`);
    console.log(`  - Password: ${doctorPassword}`);
    console.log(`\nSession Request 1 (PENDING_PAYMENT):`);
    console.log(`  - Request ID: ${sessionRequest1._id}`);
    console.log(`  - Date: ${tomorrowDateStr}`);
    console.log(`  - Status: ${sessionRequest1.status}`);
    console.log(`\nSession Request 2 (PENDING_APPROVAL):`);
    console.log(`  - Request ID: ${sessionRequest2._id}`);
    console.log(`  - Date: ${dayAfterTomorrowDateStr}`);
    console.log(`  - Status: ${sessionRequest2.status}`);
    console.log('\n✅ Test completed!');
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error during test:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testBookingFlow();

