import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { ForumPost, ForumPostSchema } from '../src/models/schemas/forum-post.schema';
import { ForumComment, ForumCommentSchema } from '../src/models/schemas/forum-comment.schema';

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

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function testPass(name: string, details?: any) {
  results.push({ name, passed: true, details });
  console.log(`✅ ${name}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

function testFail(name: string, error: string) {
  results.push({ name, passed: false, error });
  console.log(`❌ ${name}`);
  console.log(`   Error: ${error}`);
}

// Helper function to make HTTP requests
function makeRequest(url: string, options: { method: string; headers?: any; body?: string }): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
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
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 200, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: { raw: data } });
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

async function testForumAdmin() {
  try {
    console.log('🧪 Starting Forum Admin Endpoints Test Suite\n');
    console.log('='.repeat(60));

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

    console.log(`📦 Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Get or create models
    let UserModel: mongoose.Model<any>;
    let ForumPostModel: mongoose.Model<any>;
    let ForumCommentModel: mongoose.Model<any>;

    try {
      UserModel = mongoose.model('User');
    } catch {
      UserModel = mongoose.model('User', UserSchema);
    }

    try {
      ForumPostModel = mongoose.model('ForumPost');
    } catch {
      ForumPostModel = mongoose.model('ForumPost', ForumPostSchema);
    }

    try {
      ForumCommentModel = mongoose.model('ForumComment');
    } catch {
      ForumCommentModel = mongoose.model('ForumComment', ForumCommentSchema);
    }

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await UserModel.deleteMany({ email: { $regex: /^test.*@test\.com$/ } }).exec();
    await ForumPostModel.deleteMany({ title: { $regex: /^\[TEST\]/ } }).exec();
    console.log('✅ Cleanup complete\n');

    // ==================== Setup Test Users ====================
    console.log('👥 Setting up test users...');
    
    // Create admin user
    const adminEmail = 'test-admin@test.com';
    const adminPassword = 'testpass123';
    let adminUser = await UserModel.findOne({ email: adminEmail }).exec();
    
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = new UserModel({
        email: adminEmail,
        password: hashedPassword,
        user_type: 'admin',
        first_name: 'Test',
        last_name: 'Admin',
        is_email_verified: true,
      });
      await adminUser.save();
    }

    // Create regular user
    const userEmail = 'test-user@test.com';
    const userPassword = 'testpass123';
    let regularUser = await UserModel.findOne({ email: userEmail }).exec();
    
    if (!regularUser) {
      const hashedPassword = await bcrypt.hash(userPassword, 10);
      regularUser = new UserModel({
        email: userEmail,
        password: hashedPassword,
        user_type: 'user',
        first_name: 'Test',
        last_name: 'User',
        is_email_verified: true,
      });
      await regularUser.save();
    }

    // Generate admin token
    const adminToken = jwt.sign(
      {
        user_id: adminUser._id.toString(),
        email: adminUser.email,
        user_type: adminUser.user_type,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.SECRET_KEY || 'default-secret',
    );

    // Generate regular user token
    const userToken = jwt.sign(
      {
        user_id: regularUser._id.toString(),
        email: regularUser.email,
        user_type: regularUser.user_type,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      process.env.SECRET_KEY || 'default-secret',
    );

    console.log('✅ Test users created\n');

    // ==================== Test 1: Create Test Posts ====================
    console.log('📝 Creating test posts...');
    
    const testPost1 = new ForumPostModel({
      user_id: regularUser._id,
      title: '[TEST] Admin Test Post 1',
      description: 'This is a test post for admin testing purposes. It contains enough content to be valid.',
      category: 'Anxiety',
      is_anonymous: false,
    });
    await testPost1.save();

    const testPost2 = new ForumPostModel({
      user_id: regularUser._id,
      title: '[TEST] Admin Test Post 2',
      description: 'Another test post for comprehensive admin testing. This will be used for various operations.',
      category: 'Depression',
      is_anonymous: false,
    });
    await testPost2.save();

    console.log('✅ Test posts created\n');

    // ==================== Test 2: Create Test Comments ====================
    console.log('💬 Creating test comments...');
    
    const testComment1 = new ForumCommentModel({
      post_id: testPost1._id,
      user_id: regularUser._id,
      content: '[TEST] This is a test comment for admin testing.',
      is_anonymous: false,
    });
    await testComment1.save();

    const testComment2 = new ForumCommentModel({
      post_id: testPost1._id,
      user_id: regularUser._id,
      content: '[TEST] Another test comment for comprehensive testing.',
      is_anonymous: false,
    });
    await testComment2.save();

    console.log('✅ Test comments created\n');

    // ==================== Test Suite ====================
    console.log('🚀 Starting Admin Forum Endpoints Tests\n');
    console.log('='.repeat(60));

    // Test 1: Get All Posts (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success && Array.isArray(response.data.data)) {
        testPass('GET /api/v1/forum/admin/posts - Get all posts', {
          total: response.data.data.length,
          pagination: response.data.pagination,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts', error.message);
    }

    // Test 2: Get All Posts with Search
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts?search=Admin Test`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success) {
        testPass('GET /api/v1/forum/admin/posts?search=... - Search posts', {
          found: response.data.data.length,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts?search=...', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts?search=...', error.message);
    }

    // Test 3: Get All Posts with Category Filter
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts?category=Anxiety`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success) {
        testPass('GET /api/v1/forum/admin/posts?category=... - Filter by category', {
          found: response.data.data.length,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts?category=...', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts?category=...', error.message);
    }

    // Test 4: Get Post by ID (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts/${testPost1._id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success && response.data.data._id) {
        testPass('GET /api/v1/forum/admin/posts/:id - Get post by ID', {
          post_id: response.data.data._id,
          has_user: !!response.data.data.user,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts/:id', error.message);
    }

    // Test 5: Update Post (Admin)
    try {
      const updateData = {
        title: '[TEST] Updated by Admin',
        description: 'This post has been updated by an admin user.',
      };

      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts/${testPost1._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(updateData),
      });

      if (response.status === 200 && response.data.success && response.data.data.title === updateData.title) {
        testPass('PUT /api/v1/forum/admin/posts/:id - Update post', {
          updated_title: response.data.data.title,
        });
      } else {
        testFail('PUT /api/v1/forum/admin/posts/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('PUT /api/v1/forum/admin/posts/:id', error.message);
    }

    // Test 6: Get Comments for Post (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts/${testPost1._id}/comments`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success && Array.isArray(response.data.data)) {
        testPass('GET /api/v1/forum/admin/posts/:postId/comments - Get comments', {
          comments_count: response.data.data.length,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts/:postId/comments', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts/:postId/comments', error.message);
    }

    // Test 7: Get Comment by ID (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/comments/${testComment1._id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success && response.data.data._id) {
        testPass('GET /api/v1/forum/admin/comments/:id - Get comment by ID', {
          comment_id: response.data.data._id,
          has_user: !!response.data.data.user,
        });
      } else {
        testFail('GET /api/v1/forum/admin/comments/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/comments/:id', error.message);
    }

    // Test 8: Update Comment (Admin)
    try {
      const updateData = {
        content: '[TEST] Updated comment by Admin',
      };

      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/comments/${testComment1._id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(updateData),
      });

      if (response.status === 200 && response.data.success && response.data.data.content === updateData.content) {
        testPass('PUT /api/v1/forum/admin/comments/:id - Update comment', {
          updated_content: response.data.data.content,
        });
      } else {
        testFail('PUT /api/v1/forum/admin/comments/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('PUT /api/v1/forum/admin/comments/:id', error.message);
    }

    // Test 9: Get Forum Statistics (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/stats`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success && response.data.data.total_posts !== undefined) {
        testPass('GET /api/v1/forum/admin/stats - Get forum statistics', {
          stats: response.data.data,
        });
      } else {
        testFail('GET /api/v1/forum/admin/stats', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/stats', error.message);
    }

    // Test 10: Delete Comment (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/comments/${testComment2._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success) {
        // Verify comment is deleted
        const deletedComment = await ForumCommentModel.findById(testComment2._id).exec();
        if (!deletedComment) {
          testPass('DELETE /api/v1/forum/admin/comments/:id - Delete comment', {
            deleted: true,
          });
        } else {
          testFail('DELETE /api/v1/forum/admin/comments/:id', 'Comment still exists after deletion');
        }
      } else {
        testFail('DELETE /api/v1/forum/admin/comments/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('DELETE /api/v1/forum/admin/comments/:id', error.message);
    }

    // Test 11: Delete Post (Admin)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts/${testPost2._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (response.status === 200 && response.data.success) {
        // Verify post is deleted
        const deletedPost = await ForumPostModel.findById(testPost2._id).exec();
        if (!deletedPost) {
          testPass('DELETE /api/v1/forum/admin/posts/:id - Delete post', {
            deleted: true,
          });
        } else {
          testFail('DELETE /api/v1/forum/admin/posts/:id', 'Post still exists after deletion');
        }
      } else {
        testFail('DELETE /api/v1/forum/admin/posts/:id', `Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('DELETE /api/v1/forum/admin/posts/:id', error.message);
    }

    // Test 12: Unauthorized Access (Regular User)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (response.status === 403 || response.status === 401) {
        testPass('GET /api/v1/forum/admin/posts - Unauthorized access blocked', {
          status: response.status,
          message: response.data.message || 'Access denied',
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts - Unauthorized access', `Should return 403/401 but got ${response.status}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts - Unauthorized access', error.message);
    }

    // Test 13: No Token Access
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/admin/posts`, {
        method: 'GET',
      });

      if (response.status === 401 || response.status === 403) {
        testPass('GET /api/v1/forum/admin/posts - No token access blocked', {
          status: response.status,
        });
      } else {
        testFail('GET /api/v1/forum/admin/posts - No token access', `Should return 401/403 but got ${response.status}`);
      }
    } catch (error: any) {
      testFail('GET /api/v1/forum/admin/posts - No token access', error.message);
    }

    // ==================== Summary ====================
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
      console.log('');
    }

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await ForumPostModel.deleteMany({ title: { $regex: /^\[TEST\]/ } }).exec();
    await ForumCommentModel.deleteMany({ content: { $regex: /^\[TEST\]/ } }).exec();
    console.log('✅ Cleanup complete\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('❌ Test suite failed:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run tests
testForumAdmin();

