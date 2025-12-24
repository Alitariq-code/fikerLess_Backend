import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';
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

async function addTestComments() {
  try {
    console.log('🚀 Starting Test Comments Addition\n');
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

    // Find or create test users
    console.log('👥 Setting up test users...');
    
    let user1 = await UserModel.findOne({ email: 'test-comment-user1@test.com' }).exec();
    if (!user1) {
      const hashedPassword = await bcrypt.hash('testpass123', 10);
      user1 = new UserModel({
        email: 'test-comment-user1@test.com',
        password: hashedPassword,
        user_type: 'user',
        first_name: 'Sarah',
        last_name: 'Johnson',
        is_email_verified: true,
      });
      await user1.save();
    }

    let user2 = await UserModel.findOne({ email: 'test-comment-user2@test.com' }).exec();
    if (!user2) {
      const hashedPassword = await bcrypt.hash('testpass123', 10);
      user2 = new UserModel({
        email: 'test-comment-user2@test.com',
        password: hashedPassword,
        user_type: 'user',
        first_name: 'Michael',
        last_name: 'Chen',
        is_email_verified: true,
      });
      await user2.save();
    }

    let user3 = await UserModel.findOne({ email: 'test-comment-user3@test.com' }).exec();
    if (!user3) {
      const hashedPassword = await bcrypt.hash('testpass123', 10);
      user3 = new UserModel({
        email: 'test-comment-user3@test.com',
        password: hashedPassword,
        user_type: 'user',
        first_name: 'Emily',
        last_name: 'Rodriguez',
        is_email_verified: true,
      });
      await user3.save();
    }

    console.log('✅ Test users ready\n');

    // Find a post to add comments to (or create one)
    console.log('📝 Finding or creating a test post...');
    let testPost = await ForumPostModel.findOne({ 
      title: { $regex: /test|demo|sample/i } 
    }).exec();

    if (!testPost) {
      // Create a test post
      testPost = new ForumPostModel({
        user_id: user1._id,
        title: 'Test Post for Comments - Mental Health Support Discussion',
        description: 'This is a test post created to demonstrate the nested comment functionality. Feel free to share your thoughts and experiences about mental health support. We encourage open and respectful discussions.',
        category: 'Anxiety',
        is_anonymous: false,
        likes_count: 0,
        comments_count: 0,
        views: 0,
      });
      await testPost.save();
      console.log('✅ Created new test post');
    } else {
      console.log('✅ Found existing test post');
    }
    console.log(`   Post ID: ${testPost._id}\n`);

    // Clean up existing test comments
    console.log('🧹 Cleaning up old test comments...');
    await ForumCommentModel.deleteMany({ 
      content: { $regex: /^\[TEST\]/ } 
    }).exec();
    console.log('✅ Cleanup complete\n');

    // Add top-level comments
    console.log('💬 Adding top-level comments...\n');

    const topLevelComments = [
      {
        user: user1,
        content: '[TEST] This is a great discussion! I\'ve been dealing with anxiety for a while now, and finding a supportive community has been incredibly helpful. Thank you for sharing your experience.',
      },
      {
        user: user2,
        content: '[TEST] I completely agree with the points made here. Mental health awareness is so important, and having a safe space to discuss these topics is invaluable.',
      },
      {
        user: user3,
        content: '[TEST] Has anyone tried meditation techniques? I\'ve found that daily meditation has significantly helped me manage my stress levels. Would love to hear others\' experiences!',
      },
      {
        user: user1,
        content: '[TEST] Professional therapy has been a game-changer for me. If anyone is on the fence about seeking help, I highly recommend it. There\'s no shame in asking for support.',
      },
    ];

    const createdComments = [];
    for (const commentData of topLevelComments) {
      const comment = new ForumCommentModel({
        post_id: testPost._id,
        user_id: commentData.user._id,
        content: commentData.content,
        is_anonymous: false,
        likes_count: Math.floor(Math.random() * 5),
        parent_comment_id: undefined,
      });
      await comment.save();
      createdComments.push(comment);
      console.log(`   ✅ Added comment by ${commentData.user.first_name} ${commentData.user.last_name}`);
    }

    // Add nested comments (replies)
    console.log('\n💬💬 Adding nested comments (replies)...\n');

    const nestedComments = [
      {
        parentIndex: 0, // Reply to first comment
        user: user2,
        content: '[TEST] Thank you for sharing! I\'ve had a similar experience. It\'s amazing how much difference a supportive community can make.',
      },
      {
        parentIndex: 0, // Another reply to first comment
        user: user3,
        content: '[TEST] I\'m so glad you found support! This community has been wonderful for me too. Keep going! 💪',
      },
      {
        parentIndex: 1, // Reply to second comment
        user: user1,
        content: '[TEST] Absolutely! Creating awareness and breaking the stigma around mental health is crucial. Every conversation helps.',
      },
      {
        parentIndex: 2, // Reply to third comment (meditation)
        user: user1,
        content: '[TEST] Yes! I\'ve been practicing mindfulness meditation for 6 months now. It\'s helped me so much with anxiety. I use guided meditation apps.',
      },
      {
        parentIndex: 2, // Another reply to meditation comment
        user: user2,
        content: '[TEST] That\'s great to hear! I started with just 5 minutes a day and gradually increased. The key is consistency.',
      },
      {
        parentIndex: 3, // Reply to therapy comment
        user: user2,
        content: '[TEST] I couldn\'t agree more! Therapy has been one of the best decisions I\'ve made. It takes courage to seek help, and that\'s something to be proud of.',
      },
      {
        parentIndex: 3, // Another reply to therapy comment
        user: user3,
        content: '[TEST] Thank you for this encouragement! I\'ve been considering therapy but was hesitant. Your words mean a lot.',
      },
    ];

    for (const nestedData of nestedComments) {
      const parentComment = createdComments[nestedData.parentIndex];
      if (parentComment) {
        const reply = new ForumCommentModel({
          post_id: testPost._id,
          user_id: nestedData.user._id,
          content: nestedData.content,
          is_anonymous: false,
          likes_count: Math.floor(Math.random() * 3),
          parent_comment_id: parentComment._id,
        });
        await reply.save();
        console.log(`   ✅ Added reply by ${nestedData.user.first_name} ${nestedData.user.last_name} to comment by ${parentComment.user_id}`);
      }
    }

    // Update post comment count
    const totalComments = await ForumCommentModel.countDocuments({ 
      post_id: testPost._id,
      parent_comment_id: { $exists: false }
    }).exec();
    
    testPost.comments_count = totalComments;
    await testPost.save();

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary\n');
    console.log(`✅ Added ${topLevelComments.length} top-level comments`);
    console.log(`✅ Added ${nestedComments.length} nested comments (replies)`);
    console.log(`✅ Total comments: ${topLevelComments.length + nestedComments.length}`);
    console.log(`✅ Post comment count updated: ${totalComments}`);
    console.log(`\n📝 Post ID: ${testPost._id}`);
    console.log(`🔗 You can view this post in the admin panel!\n`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    console.log('🎉 Test comments added successfully!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run the script
addTestComments();

