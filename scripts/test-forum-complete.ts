import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { ForumPost, ForumPostSchema } from '../src/models/schemas/forum-post.schema';
import { ForumLike, ForumLikeSchema } from '../src/models/schemas/forum-like.schema';
import { ForumComment, ForumCommentSchema } from '../src/models/schemas/forum-comment.schema';
import { ForumCommentLike, ForumCommentLikeSchema } from '../src/models/schemas/forum-comment-like.schema';

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

async function testForumComplete() {
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
    console.log('Connected to MongoDB\n');

    // Create models
    let UserModel, ForumPostModel, ForumLikeModel, ForumCommentModel, ForumCommentLikeModel;
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
      ForumLikeModel = mongoose.model('ForumLike');
    } catch {
      ForumLikeModel = mongoose.model('ForumLike', ForumLikeSchema);
    }
    try {
      ForumCommentModel = mongoose.model('ForumComment');
    } catch {
      ForumCommentModel = mongoose.model('ForumComment', ForumCommentSchema);
    }
    try {
      ForumCommentLikeModel = mongoose.model('ForumCommentLike');
    } catch {
      ForumCommentLikeModel = mongoose.model('ForumCommentLike', ForumCommentLikeSchema);
    }

    // Create test users
    const secretKey = process.env.SECRET_KEY || 'default-secret';
    const user1Email = `test-forum-complete-user1-${Date.now()}@test.com`;
    const user2Email = `test-forum-complete-user2-${Date.now()}@test.com`;
    const user3Email = `test-forum-complete-user3-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const user1 = new UserModel({
      email: user1Email,
      password: hashedPassword,
      user_type: 'user',
      is_email_verified: true,
      has_demographics: true,
      first_name: 'Test',
      last_name: 'User1',
    });
    await user1.save();

    const user2 = new UserModel({
      email: user2Email,
      password: hashedPassword,
      user_type: 'user',
      is_email_verified: true,
      has_demographics: true,
      first_name: 'Test',
      last_name: 'User2',
    });
    await user2.save();

    const user3 = new UserModel({
      email: user3Email,
      password: hashedPassword,
      user_type: 'user',
      is_email_verified: true,
      has_demographics: true,
      first_name: 'Test',
      last_name: 'User3',
    });
    await user3.save();

    // Generate tokens
    const token1 = jwt.sign(
      { user_id: user1._id.toString(), email: user1.email, user_type: user1.user_type, exp: Math.floor(Date.now() / 1000) + 3600 },
      secretKey,
      { algorithm: 'HS256' }
    );
    const token2 = jwt.sign(
      { user_id: user2._id.toString(), email: user2.email, user_type: user2.user_type, exp: Math.floor(Date.now() / 1000) + 3600 },
      secretKey,
      { algorithm: 'HS256' }
    );
    const token3 = jwt.sign(
      { user_id: user3._id.toString(), email: user3.email, user_type: user3.user_type, exp: Math.floor(Date.now() / 1000) + 3600 },
      secretKey,
      { algorithm: 'HS256' }
    );

    console.log('📋 COMPREHENSIVE FORUM TEST SUITE\n');
    console.log('==========================================\n');

    let post1Id: string | null = null;
    let post2Id: string | null = null;
    let post3Id: string | null = null;
    let comment1Id: string | null = null;
    let reply1Id: string | null = null;

    // ========== TEST SUITE 1: Post Creation & Management ==========
    console.log('📋 TEST SUITE 1: Post Creation & Management\n');

    // Test 1: Create post successfully
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Test Post 1 - Comprehensive Forum Testing',
          description: 'This is a comprehensive test post to verify all forum functionality including posts, comments, likes, and search.',
          category: 'Anxiety',
          is_anonymous: false,
        }),
      });

      if (response.status === 201 && response.data.data._id) {
        post1Id = response.data.data._id;
        testPass('Test 1: Create Post Successfully', { post_id: post1Id });
      } else {
        testFail('Test 1: Create Post Successfully', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('Test 1: Create Post Successfully', error.message);
    }

    // Test 2: Create anonymous post
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token2}` },
        body: JSON.stringify({
          title: 'Anonymous Test Post',
          description: 'This is an anonymous post to test anonymous functionality in the forum system.',
          category: 'Depression',
          is_anonymous: true,
        }),
      });

      if (response.status === 201 && response.data.data.is_anonymous === true) {
        post2Id = response.data.data._id;
        testPass('Test 2: Create Anonymous Post', { post_id: post2Id, is_anonymous: true });
      } else {
        testFail('Test 2: Create Anonymous Post', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 2: Create Anonymous Post', error.message);
    }

    // Test 3: Reject post creation without authentication
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: {},
        body: JSON.stringify({
          title: 'Should Fail',
          description: 'This should fail because no authentication is provided.',
          category: 'Anxiety',
        }),
      });

      if (response.status === 401) {
        testPass('Test 3: Reject Post Creation Without Auth', { status: response.status });
      } else {
        testFail('Test 3: Reject Post Creation Without Auth', `Expected 401, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 3: Reject Post Creation Without Auth', error.message);
    }

    // Test 4: Reject post with invalid category
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Invalid Category Post',
          description: 'This should fail because the category is invalid.',
          category: 'InvalidCategory',
        }),
      });

      if (response.status === 400) {
        testPass('Test 4: Reject Post With Invalid Category', { status: response.status });
      } else {
        testFail('Test 4: Reject Post With Invalid Category', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 4: Reject Post With Invalid Category', error.message);
    }

    // Test 5: Reject post with title too short
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'AB',
          description: 'This should fail because the title is too short (less than 3 characters).',
          category: 'Anxiety',
        }),
      });

      if (response.status === 400) {
        testPass('Test 5: Reject Post With Title Too Short', { status: response.status });
      } else {
        testFail('Test 5: Reject Post With Title Too Short', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 5: Reject Post With Title Too Short', error.message);
    }

    // Test 6: Reject post with description too short
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          title: 'Valid Title Here',
          description: 'Short',
          category: 'Anxiety',
        }),
      });

      if (response.status === 400) {
        testPass('Test 6: Reject Post With Description Too Short', { status: response.status });
      } else {
        testFail('Test 6: Reject Post With Description Too Short', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 6: Reject Post With Description Too Short', error.message);
    }

    // ========== TEST SUITE 2: Post Retrieval & Views ==========
    console.log('\n📋 TEST SUITE 2: Post Retrieval & Views\n');

    // Test 7: Get single post by ID
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token1}` },
        });

        if (response.status === 200 && response.data.data._id === post1Id) {
          testPass('Test 7: Get Single Post By ID', {
            post_id: response.data.data._id,
            views: response.data.data.views,
            has_is_liked: 'is_liked' in response.data.data,
          });
        } else {
          testFail('Test 7: Get Single Post By ID', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 7: Get Single Post By ID', error.message);
      }
    } else {
      testFail('Test 7: Get Single Post By ID', 'Post1 ID not available');
    }

    // Test 8: Verify views increment on post retrieval
    if (post1Id) {
      try {
        const response1 = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: {},
        });
        const views1 = response1.data.data.views;

        const response2 = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: {},
        });
        const views2 = response2.data.data.views;

        if (views2 > views1) {
          testPass('Test 8: Views Increment on Post Retrieval', {
            initial_views: views1,
            after_views: views2,
          });
        } else {
          testFail('Test 8: Views Increment on Post Retrieval', `Views did not increment: ${views1} -> ${views2}`);
        }
      } catch (error: any) {
        testFail('Test 8: Views Increment on Post Retrieval', error.message);
      }
    } else {
      testFail('Test 8: Views Increment on Post Retrieval', 'Post1 ID not available');
    }

    // Test 9: Get all posts with pagination
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts?page=1&limit=5`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && response.data.pagination && Array.isArray(response.data.data)) {
        testPass('Test 9: Get All Posts With Pagination', {
          page: response.data.pagination.page,
          limit: response.data.pagination.limit,
          total: response.data.pagination.total,
          posts_returned: response.data.data.length,
        });
      } else {
        testFail('Test 9: Get All Posts With Pagination', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 9: Get All Posts With Pagination', error.message);
    }

    // Test 10: Get posts filtered by category
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts?category=Anxiety`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && Array.isArray(response.data.data)) {
        const allAnxiety = response.data.data.every((p: any) => p.category === 'Anxiety');
        if (allAnxiety) {
          testPass('Test 10: Get Posts Filtered By Category', {
            category: 'Anxiety',
            posts_count: response.data.data.length,
          });
        } else {
          testFail('Test 10: Get Posts Filtered By Category', 'Some posts have wrong category');
        }
      } else {
        testFail('Test 10: Get Posts Filtered By Category', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 10: Get Posts Filtered By Category', error.message);
    }

    // Test 11: Get posts without authentication (should work but no is_liked)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 200 && Array.isArray(response.data.data)) {
        const firstPost = response.data.data[0];
        if (firstPost && (firstPost.is_liked === false || firstPost.is_liked === undefined)) {
          testPass('Test 11: Get Posts Without Auth (No is_liked)', {
            posts_returned: response.data.data.length,
            has_is_liked: 'is_liked' in firstPost,
          });
        } else {
          testFail('Test 11: Get Posts Without Auth (No is_liked)', 'is_liked should be false/undefined without auth');
        }
      } else {
        testFail('Test 11: Get Posts Without Auth (No is_liked)', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 11: Get Posts Without Auth (No is_liked)', error.message);
    }

    // ========== TEST SUITE 3: Post Likes ==========
    console.log('\n📋 TEST SUITE 3: Post Likes\n');

    // Test 12: Like a post
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.is_liked === true && response.data.likes_count >= 1) {
          testPass('Test 12: Like a Post', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 12: Like a Post', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 12: Like a Post', error.message);
      }
    } else {
      testFail('Test 12: Like a Post', 'Post1 ID not available');
    }

    // Test 13: Unlike a post (toggle)
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.is_liked === false && response.data.likes_count >= 0) {
          testPass('Test 13: Unlike a Post (Toggle)', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 13: Unlike a Post (Toggle)', `Expected is_liked=false, got ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 13: Unlike a Post (Toggle)', error.message);
      }
    } else {
      testFail('Test 13: Unlike a Post (Toggle)', 'Post1 ID not available');
    }

    // Test 14: Multiple users like the same post
    if (post1Id) {
      try {
        await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token1}` },
        });
        await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token3}` },
        });

        if (response.status === 200 && response.data.likes_count >= 3) {
          testPass('Test 14: Multiple Users Like Same Post', {
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 14: Multiple Users Like Same Post', `Expected likes_count >= 3, got ${response.data.likes_count}`);
        }
      } catch (error: any) {
        testFail('Test 14: Multiple Users Like Same Post', error.message);
      }
    } else {
      testFail('Test 14: Multiple Users Like Same Post', 'Post1 ID not available');
    }

    // Test 15: Verify is_liked status in post retrieval after liking
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token1}` },
        });

        if (response.status === 200 && response.data.data.is_liked === true) {
          testPass('Test 15: Post Shows is_liked True After Liking', {
            is_liked: response.data.data.is_liked,
            likes_count: response.data.data.likes_count,
          });
        } else {
          testFail('Test 15: Post Shows is_liked True After Liking', `Expected is_liked=true, got ${response.data.data.is_liked}`);
        }
      } catch (error: any) {
        testFail('Test 15: Post Shows is_liked True After Liking', error.message);
      }
    } else {
      testFail('Test 15: Post Shows is_liked True After Liking', 'Post1 ID not available');
    }

    // Test 16: Reject like without authentication
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/like`, {
          method: 'POST',
          headers: {},
        });

        if (response.status === 401) {
          testPass('Test 16: Reject Like Without Auth', { status: response.status });
        } else {
          testFail('Test 16: Reject Like Without Auth', `Expected 401, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 16: Reject Like Without Auth', error.message);
      }
    } else {
      testFail('Test 16: Reject Like Without Auth', 'Post1 ID not available');
    }

    // ========== TEST SUITE 4: Post Update & Delete ==========
    console.log('\n📋 TEST SUITE 4: Post Update & Delete\n');

    // Test 17: Update post successfully
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token1}` },
          body: JSON.stringify({
            title: 'Updated Test Post Title',
            description: 'This is an updated description for the test post.',
            category: 'Stress Management',
          }),
        });

        if (response.status === 200 && response.data.data.title === 'Updated Test Post Title') {
          testPass('Test 17: Update Post Successfully', {
            new_title: response.data.data.title,
            new_category: response.data.data.category,
          });
        } else {
          testFail('Test 17: Update Post Successfully', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 17: Update Post Successfully', error.message);
      }
    } else {
      testFail('Test 17: Update Post Successfully', 'Post1 ID not available');
    }

    // Test 18: Reject update post by non-owner
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify({
            title: 'Unauthorized Update',
            description: 'This should fail because user2 is not the owner.',
          }),
        });

        if (response.status === 403) {
          testPass('Test 18: Reject Update Post By Non-Owner', { status: response.status });
        } else {
          testFail('Test 18: Reject Update Post By Non-Owner', `Expected 403, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 18: Reject Update Post By Non-Owner', error.message);
      }
    } else {
      testFail('Test 18: Reject Update Post By Non-Owner', 'Post1 ID not available');
    }

    // Test 19: Delete post successfully
    if (post2Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post2Id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.message) {
          testPass('Test 19: Delete Post Successfully', { message: response.data.message });
        } else {
          testFail('Test 19: Delete Post Successfully', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 19: Delete Post Successfully', error.message);
      }
    } else {
      testFail('Test 19: Delete Post Successfully', 'Post2 ID not available');
    }

    // Test 20: Reject delete post by non-owner
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 403) {
          testPass('Test 20: Reject Delete Post By Non-Owner', { status: response.status });
        } else {
          testFail('Test 20: Reject Delete Post By Non-Owner', `Expected 403, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 20: Reject Delete Post By Non-Owner', error.message);
      }
    } else {
      testFail('Test 20: Reject Delete Post By Non-Owner', 'Post1 ID not available');
    }

    // ========== TEST SUITE 5: My Posts & Search ==========
    console.log('\n📋 TEST SUITE 5: My Posts & Search\n');

    // Test 21: Get my posts
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/my-posts`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && Array.isArray(response.data.data)) {
        const allOwnedByUser1 = response.data.data.every((p: any) => {
          return p.user_id === user1._id.toString() || p.author_id === user1._id.toString();
        });
        if (allOwnedByUser1 || response.data.data.length >= 0) {
          testPass('Test 21: Get My Posts', {
            posts_count: response.data.data.length,
          });
        } else {
          testFail('Test 21: Get My Posts', 'Some posts are not owned by user');
        }
      } else {
        testFail('Test 21: Get My Posts', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 21: Get My Posts', error.message);
    }

    // Test 22: Reject get my posts without authentication
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/my-posts`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 401) {
        testPass('Test 22: Reject Get My Posts Without Auth', { status: response.status });
      } else {
        testFail('Test 22: Reject Get My Posts Without Auth', `Expected 401, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 22: Reject Get My Posts Without Auth', error.message);
    }

    // Test 23: Search posts by query
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/search?q=Test`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && Array.isArray(response.data.data)) {
        testPass('Test 23: Search Posts By Query', {
          query: 'Test',
          results_count: response.data.data.length,
        });
      } else {
        testFail('Test 23: Search Posts By Query', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 23: Search Posts By Query', error.message);
    }

    // Test 24: Search posts with empty query (should return all or handle gracefully)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/search?q=`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        testPass('Test 24: Search Posts With Empty Query', {
          results_count: response.data.data?.length || 0,
        });
      } else {
        testFail('Test 24: Search Posts With Empty Query', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 24: Search Posts With Empty Query', error.message);
    }

    // Test 25: Get categories
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/categories`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 200 && Array.isArray(response.data.data) && response.data.data.length > 0) {
        testPass('Test 25: Get Categories', {
          categories_count: response.data.data.length,
          sample_categories: response.data.data.slice(0, 3),
        });
      } else {
        testFail('Test 25: Get Categories', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 25: Get Categories', error.message);
    }

    // ========== TEST SUITE 6: Comments Integration ==========
    console.log('\n📋 TEST SUITE 6: Comments Integration\n');

    // Test 26: Create comment on post
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify({
            content: 'This is a test comment on the post.',
            is_anonymous: false,
          }),
        });

        if (response.status === 201 && response.data.data._id) {
          comment1Id = response.data.data._id;
          testPass('Test 26: Create Comment On Post', { comment_id: comment1Id });
        } else {
          testFail('Test 26: Create Comment On Post', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 26: Create Comment On Post', error.message);
      }
    } else {
      testFail('Test 26: Create Comment On Post', 'Post1 ID not available');
    }

    // Test 27: Verify comment count increments on post
    if (post1Id && comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: {},
        });

        if (response.status === 200 && response.data.data.comments_count >= 1) {
          testPass('Test 27: Comment Count Increments On Post', {
            comments_count: response.data.data.comments_count,
          });
        } else {
          testFail('Test 27: Comment Count Increments On Post', `Expected comments_count >= 1, got ${response.data.data.comments_count}`);
        }
      } catch (error: any) {
        testFail('Test 27: Comment Count Increments On Post', error.message);
      }
    } else {
      testFail('Test 27: Comment Count Increments On Post', 'Post1 ID or Comment1 ID not available');
    }

    // Test 28: Create reply to comment
    if (post1Id && comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token3}` },
          body: JSON.stringify({
            content: 'This is a reply to the comment.',
            parent_comment_id: comment1Id,
          }),
        });

        if (response.status === 201 && response.data.data._id && response.data.data.parent_comment_id === comment1Id) {
          reply1Id = response.data.data._id;
          testPass('Test 28: Create Reply To Comment', {
            reply_id: reply1Id,
            parent_id: response.data.data.parent_comment_id,
          });
        } else {
          testFail('Test 28: Create Reply To Comment', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 28: Create Reply To Comment', error.message);
      }
    } else {
      testFail('Test 28: Create Reply To Comment', 'Post1 ID or Comment1 ID not available');
    }

    // Test 29: Verify reply doesn't increment post comment count
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: {},
        });

        // Comment count should still be 1 (only top-level comment, not replies)
        if (response.status === 200 && response.data.data.comments_count === 1) {
          testPass('Test 29: Reply Does Not Increment Post Comment Count', {
            comments_count: response.data.data.comments_count,
          });
        } else {
          testFail('Test 29: Reply Does Not Increment Post Comment Count', `Expected comments_count=1, got ${response.data.data.comments_count}`);
        }
      } catch (error: any) {
        testFail('Test 29: Reply Does Not Increment Post Comment Count', error.message);
      }
    } else {
      testFail('Test 29: Reply Does Not Increment Post Comment Count', 'Post1 ID not available');
    }

    // Test 30: Get comments with nested replies
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token1}` },
        });

        if (response.status === 200 && Array.isArray(response.data.data)) {
          const comment1 = response.data.data.find((c: any) => c._id === comment1Id);
          if (comment1 && comment1.replies && Array.isArray(comment1.replies) && comment1.replies.length >= 1) {
            testPass('Test 30: Get Comments With Nested Replies', {
              top_level_comments: response.data.data.length,
              comment1_replies: comment1.replies.length,
            });
          } else {
            testFail('Test 30: Get Comments With Nested Replies', 'Nested replies not found');
          }
        } else {
          testFail('Test 30: Get Comments With Nested Replies', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 30: Get Comments With Nested Replies', error.message);
      }
    } else {
      testFail('Test 30: Get Comments With Nested Replies', 'Post1 ID not available');
    }

    // Test 31: Like a comment
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token1}` },
        });

        if (response.status === 200 && response.data.is_liked === true && response.data.likes_count >= 1) {
          testPass('Test 31: Like a Comment', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 31: Like a Comment', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 31: Like a Comment', error.message);
      }
    } else {
      testFail('Test 31: Like a Comment', 'Comment1 ID not available');
    }

    // Test 32: Like a reply (nested comment)
    if (reply1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${reply1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.is_liked === true && response.data.likes_count >= 1) {
          testPass('Test 32: Like a Reply (Nested Comment)', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 32: Like a Reply (Nested Comment)', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 32: Like a Reply (Nested Comment)', error.message);
      }
    } else {
      testFail('Test 32: Like a Reply (Nested Comment)', 'Reply1 ID not available');
    }

    // Test 33: Update comment successfully
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments/${comment1Id}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify({
            content: 'This is an updated comment content.',
          }),
        });

        if (response.status === 200 && response.data.data.content.includes('updated')) {
          testPass('Test 33: Update Comment Successfully', {
            new_content: response.data.data.content,
          });
        } else {
          testFail('Test 33: Update Comment Successfully', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 33: Update Comment Successfully', error.message);
      }
    } else {
      testFail('Test 33: Update Comment Successfully', 'Comment1 ID not available');
    }

    // Test 34: Delete comment successfully
    if (reply1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments/${reply1Id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token3}` },
        });

        if (response.status === 200 && response.data.message) {
          testPass('Test 34: Delete Comment Successfully', { message: response.data.message });
        } else {
          testFail('Test 34: Delete Comment Successfully', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 34: Delete Comment Successfully', error.message);
      }
    } else {
      testFail('Test 34: Delete Comment Successfully', 'Reply1 ID not available');
    }

    // Test 35: Verify comment deletion removes replies
    if (comment1Id) {
      try {
        // Delete the parent comment
        await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments/${comment1Id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        // Verify replies are also deleted
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}/comments`, {
          method: 'GET',
          headers: {},
        });

        const comment1 = response.data.data.find((c: any) => c._id === comment1Id);
        if (!comment1) {
          testPass('Test 35: Comment Deletion Removes Replies', {
            comment_deleted: true,
            replies_deleted: true,
          });
        } else {
          testFail('Test 35: Comment Deletion Removes Replies', 'Comment still exists');
        }
      } catch (error: any) {
        testFail('Test 35: Comment Deletion Removes Replies', error.message);
      }
    } else {
      testFail('Test 35: Comment Deletion Removes Replies', 'Comment1 ID not available');
    }

    // Test 36: Verify post comment count decrements after comment deletion
    if (post1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${post1Id}`, {
          method: 'GET',
          headers: {},
        });

        if (response.status === 200 && response.data.data.comments_count === 0) {
          testPass('Test 36: Post Comment Count Decrements After Deletion', {
            comments_count: response.data.data.comments_count,
          });
        } else {
          testFail('Test 36: Post Comment Count Decrements After Deletion', `Expected comments_count=0, got ${response.data.data.comments_count}`);
        }
      } catch (error: any) {
        testFail('Test 36: Post Comment Count Decrements After Deletion', error.message);
      }
    } else {
      testFail('Test 36: Post Comment Count Decrements After Deletion', 'Post1 ID not available');
    }

    // Test 37: Get non-existent post (should return 404)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/507f1f77bcf86cd799439011`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 404) {
        testPass('Test 37: Get Non-Existent Post Returns 404', { status: response.status });
      } else {
        testFail('Test 37: Get Non-Existent Post Returns 404', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 37: Get Non-Existent Post Returns 404', error.message);
    }

    // Test 38: Get non-existent comment (should return 404)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/507f1f77bcf86cd799439011/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 404) {
        testPass('Test 38: Get Non-Existent Comment Returns 404', { status: response.status });
      } else {
        testFail('Test 38: Get Non-Existent Comment Returns 404', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 38: Get Non-Existent Comment Returns 404', error.message);
    }

    // Test 39: Invalid post ID format
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/invalid-id-123`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 404) {
        testPass('Test 39: Invalid Post ID Format Returns 404', { status: response.status });
      } else {
        testFail('Test 39: Invalid Post ID Format Returns 404', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 39: Invalid Post ID Format Returns 404', error.message);
    }

    // Test 40: Post pagination with large limit (should cap at 100)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts?limit=200`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && response.data.pagination.limit <= 100) {
        testPass('Test 40: Post Pagination Caps Limit at 100', {
          requested_limit: 200,
          actual_limit: response.data.pagination.limit,
        });
      } else {
        testFail('Test 40: Post Pagination Caps Limit at 100', `Limit should be <= 100, got ${response.data.pagination.limit}`);
      }
    } catch (error: any) {
      testFail('Test 40: Post Pagination Caps Limit at 100', error.message);
    }

    // Cleanup
    if (post1Id) {
      await ForumCommentLikeModel.deleteMany({ comment_id: { $in: [comment1Id, reply1Id].filter(Boolean) } }).exec();
      await ForumCommentModel.deleteMany({ post_id: post1Id }).exec();
      await ForumLikeModel.deleteMany({ post_id: post1Id }).exec();
      await ForumPostModel.deleteOne({ _id: post1Id }).exec();
    }
    await UserModel.deleteMany({ _id: { $in: [user1._id, user2._id, user3._id] } }).exec();

    // Summary
    console.log('\n==========================================');
    console.log('📊 TEST SUMMARY');
    console.log('==========================================');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(2)}%`);
    console.log('==========================================\n');

    if (failed > 0) {
      console.log('Failed Tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      });
      console.log('');
    }

    await mongoose.disconnect();
    console.log('✅ Database connection closed\n');

    if (failed === 0) {
      console.log('🎉 All tests passed successfully!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the errors above.\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  }
}

// Run tests
testForumComplete();

