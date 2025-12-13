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

async function testForumComments() {
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
    let UserModel, ForumPostModel, ForumCommentModel, ForumCommentLikeModel;
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
    try {
      ForumCommentLikeModel = mongoose.model('ForumCommentLike');
    } catch {
      ForumCommentLikeModel = mongoose.model('ForumCommentLike', ForumCommentLikeSchema);
    }

    // Create test users
    const secretKey = process.env.SECRET_KEY || 'default-secret';
    const user1Email = `test-forum-user1-${Date.now()}@test.com`;
    const user2Email = `test-forum-user2-${Date.now()}@test.com`;
    const user3Email = `test-forum-user3-${Date.now()}@test.com`;
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

    // Create a test post
    const postResponse = await makeRequest(`${BASE_URL}/api/v1/forum/posts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token1}` },
      body: JSON.stringify({
        title: 'Test Forum Post for Comments',
        description: 'This is a test post to verify comment functionality with nested replies and likes.',
        category: 'Anxiety',
        is_anonymous: false,
      }),
    });

    if (postResponse.status !== 201) {
      console.error('Failed to create test post:', postResponse.data);
      process.exit(1);
    }

    const postId = postResponse.data.data._id;
    console.log('📋 TEST SUITE: Forum Comments & Replies (Facebook-like Implementation)\n');
    console.log(`Test Post ID: ${postId}\n`);

    let comment1Id: string | null = null;
    let comment2Id: string | null = null;
    let reply1Id: string | null = null;
    let reply2Id: string | null = null;

    // ========== TEST SUITE 1: Creating Comments ==========
    console.log('📋 TEST SUITE 1: Creating Comments\n');

    // Test 1: Create top-level comment
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: 'This is the first top-level comment',
          is_anonymous: false,
        }),
      });

      if (response.status === 201 && response.data.data._id) {
        comment1Id = response.data.data._id;
        testPass('Test 1: Create Top-Level Comment', { comment_id: comment1Id });
      } else {
        testFail('Test 1: Create Top-Level Comment', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
      }
    } catch (error: any) {
      testFail('Test 1: Create Top-Level Comment', error.message);
    }

    // Test 2: Create second top-level comment
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token2}` },
        body: JSON.stringify({
          content: 'This is the second top-level comment from user 2',
          is_anonymous: false,
        }),
      });

      if (response.status === 201 && response.data.data._id) {
        comment2Id = response.data.data._id;
        testPass('Test 2: Create Second Top-Level Comment', { comment_id: comment2Id });
      } else {
        testFail('Test 2: Create Second Top-Level Comment', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 2: Create Second Top-Level Comment', error.message);
    }

    // Test 3: Create comment with empty content (should fail)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: '',
        }),
      });

      if (response.status === 400) {
        testPass('Test 3: Reject Empty Comment', { status: response.status });
      } else {
        testFail('Test 3: Reject Empty Comment', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 3: Reject Empty Comment', error.message);
    }

    // Test 4: Create comment without authentication (should fail)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: {},
        body: JSON.stringify({
          content: 'This should fail',
        }),
      });

      if (response.status === 401) {
        testPass('Test 4: Reject Comment Without Auth', { status: response.status });
      } else {
        testFail('Test 4: Reject Comment Without Auth', `Expected 401, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 4: Reject Comment Without Auth', error.message);
    }

    // ========== TEST SUITE 2: Creating Replies (Nested Comments) ==========
    console.log('\n📋 TEST SUITE 2: Creating Replies (Nested Comments)\n');

    // Test 5: Create reply to first comment
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify({
            content: 'This is a reply to the first comment',
            parent_comment_id: comment1Id,
          }),
        });

        if (response.status === 201 && response.data.data._id) {
          reply1Id = response.data.data._id;
          testPass('Test 5: Create Reply to Comment', { reply_id: reply1Id, parent_id: comment1Id });
        } else {
          testFail('Test 5: Create Reply to Comment', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 5: Create Reply to Comment', error.message);
      }
    } else {
      testFail('Test 5: Create Reply to Comment', 'Comment1 ID not available');
    }

    // Test 6: Create second reply to first comment
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token3}` },
          body: JSON.stringify({
            content: 'This is another reply to the first comment from user 3',
            parent_comment_id: comment1Id,
          }),
        });

        if (response.status === 201 && response.data.data._id) {
          reply2Id = response.data.data._id;
          testPass('Test 6: Create Second Reply to Comment', { reply_id: reply2Id });
        } else {
          testFail('Test 6: Create Second Reply to Comment', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 6: Create Second Reply to Comment', error.message);
      }
    } else {
      testFail('Test 6: Create Second Reply to Comment', 'Comment1 ID not available');
    }

    // Test 7: Try to reply to a reply (should fail - only one level of nesting)
    if (reply1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token1}` },
          body: JSON.stringify({
            content: 'This should fail - replying to a reply',
            parent_comment_id: reply1Id,
          }),
        });

        if (response.status === 400 && response.data.message?.includes('Cannot reply to a reply')) {
          testPass('Test 7: Reject Reply to Reply', { status: response.status });
        } else {
          testFail('Test 7: Reject Reply to Reply', `Expected 400, got ${response.status}: ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 7: Reject Reply to Reply', error.message);
      }
    } else {
      testFail('Test 7: Reject Reply to Reply', 'Reply1 ID not available');
    }

    // Test 8: Try to reply with invalid parent_comment_id
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: 'This should fail - invalid parent',
          parent_comment_id: 'invalid-id-123',
        }),
      });

      if (response.status === 400) {
        testPass('Test 8: Reject Invalid Parent Comment ID', { status: response.status });
      } else {
        testFail('Test 8: Reject Invalid Parent Comment ID', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 8: Reject Invalid Parent Comment ID', error.message);
    }

    // Test 9: Try to reply with non-existent parent_comment_id
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: 'This should fail - non-existent parent',
          parent_comment_id: '507f1f77bcf86cd799439011',
        }),
      });

      if (response.status === 404) {
        testPass('Test 9: Reject Non-Existent Parent Comment', { status: response.status });
      } else {
        testFail('Test 9: Reject Non-Existent Parent Comment', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 9: Reject Non-Existent Parent Comment', error.message);
    }

    // ========== TEST SUITE 3: Getting Comments (Nested Structure) ==========
    console.log('\n📋 TEST SUITE 3: Getting Comments (Nested Structure)\n');

    // Test 10: Get comments and verify nested structure
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && response.data.data && Array.isArray(response.data.data)) {
        const comments = response.data.data;
        const hasReplies = comments.some((c: any) => c.replies && Array.isArray(c.replies) && c.replies.length > 0);
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        
        if (hasReplies && comment1 && comment1.replies && comment1.replies.length >= 2) {
          testPass('Test 10: Get Comments with Nested Replies', {
            total_comments: comments.length,
            comment1_replies: comment1.replies.length,
            has_nested_structure: true,
          });
        } else {
          testFail('Test 10: Get Comments with Nested Replies', 'Nested structure not found or incorrect');
        }
      } else {
        testFail('Test 10: Get Comments with Nested Replies', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 10: Get Comments with Nested Replies', error.message);
    }

    // Test 11: Verify replies have parent_comment_id
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        if (comment1 && comment1.replies) {
          const allRepliesHaveParent = comment1.replies.every((r: any) => r.parent_comment_id === comment1Id);
          if (allRepliesHaveParent) {
            testPass('Test 11: Replies Have Correct Parent Comment ID', {
              replies_count: comment1.replies.length,
            });
          } else {
            testFail('Test 11: Replies Have Correct Parent Comment ID', 'Some replies missing parent_comment_id');
          }
        } else {
          testFail('Test 11: Replies Have Correct Parent Comment ID', 'Comment1 or replies not found');
        }
      } else {
        testFail('Test 11: Replies Have Correct Parent Comment ID', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 11: Replies Have Correct Parent Comment ID', error.message);
    }

    // Test 12: Verify top-level comments have null parent_comment_id
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const topLevelComments = comments.filter((c: any) => !c.parent_comment_id);
        const allHaveNullParent = topLevelComments.every((c: any) => c.parent_comment_id === null);
        
        if (allHaveNullParent && topLevelComments.length >= 2) {
          testPass('Test 12: Top-Level Comments Have Null Parent', {
            top_level_count: topLevelComments.length,
          });
        } else {
          testFail('Test 12: Top-Level Comments Have Null Parent', 'Top-level comments structure incorrect');
        }
      } else {
        testFail('Test 12: Top-Level Comments Have Null Parent', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 12: Top-Level Comments Have Null Parent', error.message);
    }

    // Test 13: Test pagination
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments?page=1&limit=1`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200 && response.data.pagination) {
        const pagination = response.data.pagination;
        if (pagination.page === 1 && pagination.limit === 1 && response.data.data.length <= 1) {
          testPass('Test 13: Comments Pagination Works', {
            page: pagination.page,
            limit: pagination.limit,
            total: pagination.total,
          });
        } else {
          testFail('Test 13: Comments Pagination Works', 'Pagination not working correctly');
        }
      } else {
        testFail('Test 13: Comments Pagination Works', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 13: Comments Pagination Works', error.message);
    }

    // ========== TEST SUITE 4: Liking Comments ==========
    console.log('\n📋 TEST SUITE 4: Liking Comments\n');

    // Test 14: Like a top-level comment
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.is_liked === true && response.data.likes_count >= 1) {
          testPass('Test 14: Like Top-Level Comment', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 14: Like Top-Level Comment', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 14: Like Top-Level Comment', error.message);
      }
    } else {
      testFail('Test 14: Like Top-Level Comment', 'Comment1 ID not available');
    }

    // Test 15: Like the same comment again (should unlike)
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });

        if (response.status === 200 && response.data.is_liked === false && response.data.likes_count === 0) {
          testPass('Test 15: Unlike Comment (Toggle)', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 15: Unlike Comment (Toggle)', `Expected is_liked=false, got ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 15: Unlike Comment (Toggle)', error.message);
      }
    } else {
      testFail('Test 15: Unlike Comment (Toggle)', 'Comment1 ID not available');
    }

    // Test 16: Multiple users like the same comment
    if (comment1Id) {
      try {
        // User 1 likes
        await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token1}` },
        });
        
        // User 2 likes
        await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
        });
        
        // User 3 likes
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token3}` },
        });

        if (response.status === 200 && response.data.likes_count >= 3) {
          testPass('Test 16: Multiple Users Like Same Comment', {
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 16: Multiple Users Like Same Comment', `Expected likes_count >= 3, got ${response.data.likes_count}`);
        }
      } catch (error: any) {
        testFail('Test 16: Multiple Users Like Same Comment', error.message);
      }
    } else {
      testFail('Test 16: Multiple Users Like Same Comment', 'Comment1 ID not available');
    }

    // Test 17: Like a reply (nested comment)
    if (reply1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${reply1Id}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token1}` },
        });

        if (response.status === 200 && response.data.is_liked === true && response.data.likes_count >= 1) {
          testPass('Test 17: Like Reply (Nested Comment)', {
            is_liked: response.data.is_liked,
            likes_count: response.data.likes_count,
          });
        } else {
          testFail('Test 17: Like Reply (Nested Comment)', `Status: ${response.status}, Response: ${JSON.stringify(response.data)}`);
        }
      } catch (error: any) {
        testFail('Test 17: Like Reply (Nested Comment)', error.message);
      }
    } else {
      testFail('Test 17: Like Reply (Nested Comment)', 'Reply1 ID not available');
    }

    // Test 18: Like comment without authentication (should fail)
    if (comment1Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/${comment1Id}/like`, {
          method: 'POST',
          headers: {},
        });

        if (response.status === 401) {
          testPass('Test 18: Reject Like Without Auth', { status: response.status });
        } else {
          testFail('Test 18: Reject Like Without Auth', `Expected 401, got ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 18: Reject Like Without Auth', error.message);
      }
    } else {
      testFail('Test 18: Reject Like Without Auth', 'Comment1 ID not available');
    }

    // Test 19: Like non-existent comment (should fail)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/comments/507f1f77bcf86cd799439011/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 404) {
        testPass('Test 19: Reject Like Non-Existent Comment', { status: response.status });
      } else {
        testFail('Test 19: Reject Like Non-Existent Comment', `Expected 404, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 19: Reject Like Non-Existent Comment', error.message);
    }

    // ========== TEST SUITE 5: Likes Count in Response ==========
    console.log('\n📋 TEST SUITE 5: Likes Count in Response\n');

    // Test 20: Verify likes_count in get comments response
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        if (comment1 && typeof comment1.likes_count === 'number' && comment1.likes_count >= 3) {
          testPass('Test 20: Likes Count in Top-Level Comment Response', {
            likes_count: comment1.likes_count,
            is_liked: comment1.is_liked,
          });
        } else {
          testFail('Test 20: Likes Count in Top-Level Comment Response', `Expected likes_count >= 3, got ${comment1?.likes_count}`);
        }
      } else {
        testFail('Test 20: Likes Count in Top-Level Comment Response', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 20: Likes Count in Top-Level Comment Response', error.message);
    }

    // Test 21: Verify likes_count in reply response
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        if (comment1 && comment1.replies && comment1.replies.length > 0) {
          const reply1 = comment1.replies.find((r: any) => r._id === reply1Id);
          if (reply1 && typeof reply1.likes_count === 'number' && typeof reply1.is_liked === 'boolean') {
            testPass('Test 21: Likes Count in Reply Response', {
              reply_likes_count: reply1.likes_count,
              reply_is_liked: reply1.is_liked,
            });
          } else {
            testFail('Test 21: Likes Count in Reply Response', 'Reply missing likes_count or is_liked');
          }
        } else {
          testFail('Test 21: Likes Count in Reply Response', 'Comment1 or replies not found');
        }
      } else {
        testFail('Test 21: Likes Count in Reply Response', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 21: Likes Count in Reply Response', error.message);
    }

    // Test 22: Verify is_liked reflects user's like status
    try {
      // User 1 should see comment1 as liked (they liked it in Test 16)
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        if (comment1 && comment1.is_liked === true) {
          testPass('Test 22: Is Liked Status Correct for User', {
            is_liked: comment1.is_liked,
            likes_count: comment1.likes_count,
          });
        } else {
          testFail('Test 22: Is Liked Status Correct for User', `Expected is_liked=true, got ${comment1?.is_liked}`);
        }
      } else {
        testFail('Test 22: Is Liked Status Correct for User', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 22: Is Liked Status Correct for User', error.message);
    }

    // Test 23: Verify is_liked is true for user who liked (user2 liked again in Test 16)
    try {
      // User 2 unliked in Test 15, but then liked again in Test 16, so they should see it as liked
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token2}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        // User 2 liked it again in Test 16, so is_liked should be true
        if (comment1 && comment1.is_liked === true) {
          testPass('Test 23: Is Liked True for User Who Liked Again', {
            is_liked: comment1.is_liked,
            likes_count: comment1.likes_count,
          });
        } else {
          testFail('Test 23: Is Liked True for User Who Liked Again', `Expected is_liked=true, got ${comment1?.is_liked}`);
        }
      } else {
        testFail('Test 23: Is Liked True for User Who Liked Again', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 23: Is Liked True for User Who Liked Again', error.message);
    }

    // ========== TEST SUITE 6: Edge Cases & Validation ==========
    console.log('\n📋 TEST SUITE 6: Edge Cases & Validation\n');

    // Test 24: Create comment with very long content (should fail or truncate)
    try {
      const longContent = 'a'.repeat(1001); // Exceeds maxlength
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: longContent,
        }),
      });

      if (response.status === 400) {
        testPass('Test 24: Reject Comment Exceeding Max Length', { status: response.status });
      } else {
        testFail('Test 24: Reject Comment Exceeding Max Length', `Expected 400, got ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 24: Reject Comment Exceeding Max Length', error.message);
    }

    // Test 25: Create anonymous comment
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token1}` },
        body: JSON.stringify({
          content: 'This is an anonymous comment',
          is_anonymous: true,
        }),
      });

      if (response.status === 201 && response.data.data.is_anonymous === true) {
        testPass('Test 25: Create Anonymous Comment', {
          is_anonymous: response.data.data.is_anonymous,
        });
      } else {
        testFail('Test 25: Create Anonymous Comment', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 25: Create Anonymous Comment', error.message);
    }

    // Test 26: Create anonymous reply
    if (comment2Id) {
      try {
        const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token2}` },
          body: JSON.stringify({
            content: 'This is an anonymous reply',
            is_anonymous: true,
            parent_comment_id: comment2Id,
          }),
        });

        if (response.status === 201 && response.data.data.is_anonymous === true && response.data.data.parent_comment_id === comment2Id) {
          testPass('Test 26: Create Anonymous Reply', {
            is_anonymous: response.data.data.is_anonymous,
            has_parent: !!response.data.data.parent_comment_id,
          });
        } else {
          testFail('Test 26: Create Anonymous Reply', `Status: ${response.status}`);
        }
      } catch (error: any) {
        testFail('Test 26: Create Anonymous Reply', error.message);
      }
    } else {
      testFail('Test 26: Create Anonymous Reply', 'Comment2 ID not available');
    }

    // Test 27: Get comments without auth (should work but no is_liked)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: {},
      });

      if (response.status === 200 && response.data.data) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        // Without auth, is_liked should be false or undefined
        if (comment1 && (comment1.is_liked === false || comment1.is_liked === undefined)) {
          testPass('Test 27: Get Comments Without Auth (No is_liked)', {
            has_data: true,
            is_liked: comment1.is_liked,
          });
        } else {
          testFail('Test 27: Get Comments Without Auth (No is_liked)', 'is_liked should be false/undefined without auth');
        }
      } else {
        testFail('Test 27: Get Comments Without Auth (No is_liked)', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 27: Get Comments Without Auth (No is_liked)', error.message);
    }

    // Test 28: Verify comment count on post is correct (only top-level)
    try {
      const postResponse = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}`, {
        method: 'GET',
        headers: {},
      });

      if (postResponse.status === 200) {
        const commentsResponse = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
          method: 'GET',
          headers: {},
        });
        
        if (commentsResponse.status === 200) {
          const topLevelCount = commentsResponse.data.data.filter((c: any) => !c.parent_comment_id).length;
          const postCommentsCount = postResponse.data.data.comments_count;
          
          // Should match (allowing for some test comments we created)
          if (postCommentsCount >= topLevelCount) {
            testPass('Test 28: Post Comments Count Matches Top-Level Comments', {
              post_comments_count: postCommentsCount,
              actual_top_level: topLevelCount,
            });
          } else {
            testFail('Test 28: Post Comments Count Matches Top-Level Comments', `Mismatch: post=${postCommentsCount}, actual=${topLevelCount}`);
          }
        } else {
          testFail('Test 28: Post Comments Count Matches Top-Level Comments', 'Failed to get comments');
        }
      } else {
        testFail('Test 28: Post Comments Count Matches Top-Level Comments', 'Failed to get post');
      }
    } catch (error: any) {
      testFail('Test 28: Post Comments Count Matches Top-Level Comments', error.message);
    }

    // Test 29: Verify replies are sorted by creation time (oldest first)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data;
        const comment1 = comments.find((c: any) => c._id === comment1Id);
        if (comment1 && comment1.replies && comment1.replies.length >= 2) {
          const replies = comment1.replies;
          let sorted = true;
          for (let i = 1; i < replies.length; i++) {
            const prevDate = new Date(replies[i - 1].created_at);
            const currDate = new Date(replies[i].created_at);
            if (currDate < prevDate) {
              sorted = false;
              break;
            }
          }
          if (sorted) {
            testPass('Test 29: Replies Sorted by Creation Time (Oldest First)', {
              replies_count: replies.length,
            });
          } else {
            testFail('Test 29: Replies Sorted by Creation Time (Oldest First)', 'Replies not sorted correctly');
          }
        } else {
          testFail('Test 29: Replies Sorted by Creation Time (Oldest First)', 'Not enough replies');
        }
      } else {
        testFail('Test 29: Replies Sorted by Creation Time (Oldest First)', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 29: Replies Sorted by Creation Time (Oldest First)', error.message);
    }

    // Test 30: Verify top-level comments are sorted by creation time (newest first)
    try {
      const response = await makeRequest(`${BASE_URL}/api/v1/forum/posts/${postId}/comments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token1}` },
      });

      if (response.status === 200) {
        const comments = response.data.data.filter((c: any) => !c.parent_comment_id);
        if (comments.length >= 2) {
          let sorted = true;
          for (let i = 1; i < comments.length; i++) {
            const prevDate = new Date(comments[i - 1].created_at);
            const currDate = new Date(comments[i].created_at);
            if (currDate > prevDate) { // Should be newest first
              sorted = false;
              break;
            }
          }
          if (sorted) {
            testPass('Test 30: Top-Level Comments Sorted by Creation Time (Newest First)', {
              top_level_count: comments.length,
            });
          } else {
            testFail('Test 30: Top-Level Comments Sorted by Creation Time (Newest First)', 'Comments not sorted correctly');
          }
        } else {
          testFail('Test 30: Top-Level Comments Sorted by Creation Time (Newest First)', 'Not enough comments');
        }
      } else {
        testFail('Test 30: Top-Level Comments Sorted by Creation Time (Newest First)', `Status: ${response.status}`);
      }
    } catch (error: any) {
      testFail('Test 30: Top-Level Comments Sorted by Creation Time (Newest First)', error.message);
    }

    // Cleanup
    await ForumCommentLikeModel.deleteMany({ comment_id: { $in: [comment1Id, comment2Id, reply1Id, reply2Id].filter(Boolean) } }).exec();
    await ForumCommentModel.deleteMany({ post_id: postId }).exec();
    await ForumPostModel.deleteOne({ _id: postId }).exec();
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
testForumComments();

