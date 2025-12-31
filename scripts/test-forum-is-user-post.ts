import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema, User, UserDocument } from '../src/models/schemas/user.schema';
import { ForumPostSchema, ForumPost, ForumPostDocument } from '../src/models/schemas/forum-post.schema';
import { generateUniqueUsername } from '../src/utils/utils';

async function testForumIsUserPost() {
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
    const ForumPostModel = mongoose.model<ForumPostDocument>('ForumPost', ForumPostSchema);

    // Step 1: Create test user with email verified
    console.log('📝 Step 1: Creating test user...');
    const testEmail = 'test-user@fikrless.com';
    const testPassword = 'Test@123';
    
    // Check if user already exists
    let testUser = await UserModel.findOne({ email: testEmail }).exec();
    
    if (testUser) {
      console.log('ℹ️  Test user already exists, updating...');
      // Update to ensure email is verified and has demographics
      testUser.is_email_verified = true;
      testUser.has_demographics = true; // Set to true to allow login
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      testUser.password = hashedPassword;
      await testUser.save();
      console.log('✅ Test user updated with verified email and demographics');
    } else {
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const testUsername = await generateUniqueUsername('Test', 'User', testEmail, UserModel);
      
      testUser = new UserModel({
        email: testEmail,
        password: hashedPassword,
        user_type: 'user',
        is_email_verified: true, // Email verified by default
        username: testUsername,
        first_name: 'Test',
        last_name: 'User',
        otp_token: '', // No OTP needed since email is verified
        has_demographics: true, // Set to true to allow login
      });
      
      await testUser.save();
      console.log('✅ Test user created with verified email and demographics');
    }
    
    console.log(`   User ID: ${testUser._id}`);
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Email Verified: ${testUser.is_email_verified}`);
    console.log(`   Password: ${testPassword}\n`);

    // Step 2: Create another user (to test is_user_post = false)
    console.log('📝 Step 2: Creating second test user...');
    const testEmail2 = 'test-user2@fikrless.com';
    const testPassword2 = 'Test@123';
    
    let testUser2 = await UserModel.findOne({ email: testEmail2 }).exec();
    
    if (testUser2) {
      console.log('ℹ️  Second test user already exists, updating...');
      testUser2.is_email_verified = true;
      testUser2.has_demographics = true; // Set to true to allow login
      const hashedPassword2 = await bcrypt.hash(testPassword2, 10);
      testUser2.password = hashedPassword2;
      await testUser2.save();
      console.log('✅ Second test user updated with verified email and demographics');
    } else {
      const hashedPassword2 = await bcrypt.hash(testPassword2, 10);
      const testUsername2 = await generateUniqueUsername('Test', 'User2', testEmail2, UserModel);
      
      testUser2 = new UserModel({
        email: testEmail2,
        password: hashedPassword2,
        user_type: 'user',
        is_email_verified: true, // Email verified by default
        username: testUsername2,
        first_name: 'Test',
        last_name: 'User2',
        otp_token: '',
        has_demographics: true, // Set to true to allow login
      });
      
      await testUser2.save();
      console.log('✅ Second test user created with verified email and demographics');
    }
    
    console.log(`   User ID: ${testUser2._id}`);
    console.log(`   Email: ${testUser2.email}\n`);

    // Step 3: Create a forum post for testUser
    console.log('📝 Step 3: Creating forum post for first user...');
    const existingPost = await ForumPostModel.findOne({ user_id: testUser._id }).exec();
    
    let testPost;
    if (existingPost) {
      console.log('ℹ️  Post already exists, using existing post');
      testPost = existingPost;
    } else {
      testPost = new ForumPostModel({
        user_id: testUser._id,
        title: 'Test Post - is_user_post Verification',
        description: 'This is a test post to verify the is_user_post field works correctly. It should show true for the post owner and false for other users.',
        category: 'Anxiety',
        is_anonymous: false,
        likes_count: 0,
        comments_count: 0,
        views: 0,
        admin_post: false,
      });
      
      await testPost.save();
      console.log('✅ Forum post created');
    }
    
    console.log(`   Post ID: ${testPost._id}`);
    console.log(`   Post Title: ${testPost.title}\n`);

    // Step 4: Test API endpoints
    console.log('📝 Step 4: Testing API endpoints...');
    const BASE_URL = process.env.API_BASE_URL || process.env.BASE_URL || 'http://localhost:5002';
    
    // Login as testUser
    console.log('\n🔐 Logging in as first user...');
    const loginResponse1 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    
    const loginData1 = await loginResponse1.json();
    console.log('Login response:', JSON.stringify(loginData1, null, 2));
    
    if (!loginResponse1.ok) {
      throw new Error(`Login failed: ${loginData1.message || JSON.stringify(loginData1)}`);
    }
    
    if (!loginData1.token) {
      throw new Error(`No token in response: ${JSON.stringify(loginData1)}`);
    }
    const token1 = loginData1.token;
    console.log('✅ Logged in as first user');

    // Login as testUser2
    console.log('\n🔐 Logging in as second user...');
    const loginResponse2 = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail2,
        password: testPassword2,
      }),
    });
    
    const loginData2 = await loginResponse2.json();
    
    if (!loginResponse2.ok) {
      throw new Error(`Login failed: ${loginData2.message || JSON.stringify(loginData2)}`);
    }
    
    if (!loginData2.token) {
      throw new Error(`No token in response: ${JSON.stringify(loginData2)}`);
    }
    const token2 = loginData2.token;
    console.log('✅ Logged in as second user');

    // Get posts as first user (should see is_user_post = true for their post)
    console.log('\n📋 Getting posts as first user (post owner)...');
    const postsResponse1 = await fetch(`${BASE_URL}/api/v1/forum/posts`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token1}` },
    });
    
    const postsData1 = await postsResponse1.json();
    console.log('✅ Posts retrieved');
    
    // Find the test post
    const testPostInResponse = postsData1.data?.find((p: any) => p._id === testPost._id.toString());
    
    if (testPostInResponse) {
      console.log('\n📊 Results for Post Owner (First User):');
      console.log(`   Post ID: ${testPostInResponse._id}`);
      console.log(`   Title: ${testPostInResponse.title}`);
      console.log(`   is_user_post: ${testPostInResponse.is_user_post}`);
      
      if (testPostInResponse.is_user_post === true) {
        console.log('   ✅ CORRECT: is_user_post is true for post owner');
      } else {
        console.log('   ❌ ERROR: is_user_post should be true for post owner');
      }
    } else {
      console.log('   ⚠️  Test post not found in response');
    }

    // Get posts as second user (should see is_user_post = false for the post)
    console.log('\n📋 Getting posts as second user (not post owner)...');
    const postsResponse2 = await fetch(`${BASE_URL}/api/v1/forum/posts`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token2}` },
    });
    
    const postsData2 = await postsResponse2.json();
    console.log('✅ Posts retrieved');
    
    // Find the test post
    const testPostInResponse2 = postsData2.data?.find((p: any) => p._id === testPost._id.toString());
    
    if (testPostInResponse2) {
      console.log('\n📊 Results for Non-Owner (Second User):');
      console.log(`   Post ID: ${testPostInResponse2._id}`);
      console.log(`   Title: ${testPostInResponse2.title}`);
      console.log(`   is_user_post: ${testPostInResponse2.is_user_post}`);
      
      if (testPostInResponse2.is_user_post === false) {
        console.log('   ✅ CORRECT: is_user_post is false for non-owner');
      } else {
        console.log('   ❌ ERROR: is_user_post should be false for non-owner');
      }
    } else {
      console.log('   ⚠️  Test post not found in response');
    }

    // Get post by ID as first user
    console.log('\n📋 Getting post by ID as first user (post owner)...');
    const postByIdResponse1 = await fetch(`${BASE_URL}/api/v1/forum/posts/${testPost._id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token1}` },
    });
    
    const postByIdData1 = await postByIdResponse1.json();
    if (postByIdData1.success && postByIdData1.data) {
      console.log(`   is_user_post: ${postByIdData1.data.is_user_post}`);
      if (postByIdData1.data.is_user_post === true) {
        console.log('   ✅ CORRECT: is_user_post is true when getting by ID as owner');
      } else {
        console.log('   ❌ ERROR: is_user_post should be true');
      }
    }

    // Get post by ID as second user
    console.log('\n📋 Getting post by ID as second user (not post owner)...');
    const postByIdResponse2 = await fetch(`${BASE_URL}/api/v1/forum/posts/${testPost._id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token2}` },
    });
    
    const postByIdData2 = await postByIdResponse2.json();
    if (postByIdData2.success && postByIdData2.data) {
      console.log(`   is_user_post: ${postByIdData2.data.is_user_post}`);
      if (postByIdData2.data.is_user_post === false) {
        console.log('   ✅ CORRECT: is_user_post is false when getting by ID as non-owner');
      } else {
        console.log('   ❌ ERROR: is_user_post should be false');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Test User 1: ${testEmail}`);
    console.log(`  - User ID: ${testUser._id}`);
    console.log(`  - Email Verified: ${testUser.is_email_verified ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Password: ${testPassword}`);
    console.log(`\nTest User 2: ${testEmail2}`);
    console.log(`  - User ID: ${testUser2._id}`);
    console.log(`  - Email Verified: ${testUser2.is_email_verified ? '✅ Yes' : '❌ No'}`);
    console.log(`  - Password: ${testPassword2}`);
    console.log(`\nTest Post:`);
    console.log(`  - Post ID: ${testPost._id}`);
    console.log(`  - Title: ${testPost.title}`);
    console.log(`  - Owner: ${testUser._id}`);
    console.log('\n✅ Test completed!');
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error during test:', error);
    if (error.message) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
testForumIsUserPost();

