const axios = require('axios');

const BASE_URL = 'http://localhost:5002/api/v1';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

let specialistToken = '';
let specialistUserId = '';
let regularUserToken = '';
let createdArticleId = '';

async function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
}

async function createTestUsers() {
  log('\n=== Creating Test Users ===', 'blue');

  // Create Specialist User
  log('\n1. Creating Specialist User...', 'yellow');
  const specialistSignup = await testEndpoint(
    'Signup Specialist',
    'POST',
    '/auth/signup',
    {
      email: 'specialist@test.com',
      password: 'password123',
      user_type: 'specialist',
    }
  );

  if (specialistSignup.success) {
    log('✓ Specialist user created', 'green');
    specialistUserId = specialistSignup.data.user_id;
    log(`  User ID: ${specialistUserId}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(specialistSignup.error)}`, 'red');
    if (specialistSignup.error?.message?.includes('already registered')) {
      log('  User already exists, continuing...', 'yellow');
    } else {
      throw new Error('Failed to create specialist user');
    }
  }

  // Create Regular User
  log('\n2. Creating Regular User...', 'yellow');
  const userSignup = await testEndpoint(
    'Signup User',
    'POST',
    '/auth/signup',
    {
      email: 'user@test.com',
      password: 'password123',
      user_type: 'user',
    }
  );

  if (userSignup.success) {
    log('✓ Regular user created', 'green');
  } else {
    log(`✗ Failed: ${JSON.stringify(userSignup.error)}`, 'red');
    if (userSignup.error?.message?.includes('already registered')) {
      log('  User already exists, continuing...', 'yellow');
    }
  }

  // Verify Specialist Email (get OTP from console or use a test OTP)
  log('\n3. Verifying Specialist Email...', 'yellow');
  log('  Note: In production, check email for OTP. For testing, we\'ll use a mock OTP.', 'blue');
  
  // Try to verify (this will fail if OTP is wrong, but we'll continue)
  // In real scenario, you'd need to check the database for the OTP token
  log('  Skipping email verification for now (would need OTP from email)', 'yellow');
}

async function loginUsers() {
  log('\n=== Logging In Users ===', 'blue');

  // Login Specialist
  log('\n1. Logging in Specialist...', 'yellow');
  const specialistLogin = await testEndpoint(
    'Login Specialist',
    'POST',
    '/auth/login',
    {
      email: 'specialist@test.com',
      password: 'password123',
    }
  );

  if (specialistLogin.success) {
    specialistToken = specialistLogin.data.token;
    specialistUserId = specialistLogin.data.user_id;
    log('✓ Specialist logged in', 'green');
    log(`  Token: ${specialistToken.substring(0, 20)}...`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(specialistLogin.error)}`, 'red');
    if (specialistLogin.error?.message?.includes('verify your email')) {
      log('  Email not verified. Need to verify first.', 'yellow');
      log('  Please verify email manually or check database for OTP token', 'yellow');
      throw new Error('Specialist email not verified');
    } else if (specialistLogin.error?.message?.includes('complete your specialist profile')) {
      log('  Specialist profile not completed. Will create profile first.', 'yellow');
      // Continue - we'll create profile
    } else {
      throw new Error('Failed to login specialist');
    }
  }

  // Login Regular User
  log('\n2. Logging in Regular User...', 'yellow');
  const userLogin = await testEndpoint(
    'Login User',
    'POST',
    '/auth/login',
    {
      email: 'user@test.com',
      password: 'password123',
    }
  );

  if (userLogin.success) {
    regularUserToken = userLogin.data.token;
    log('✓ Regular user logged in', 'green');
  } else {
    log(`✗ Failed: ${JSON.stringify(userLogin.error)}`, 'red');
    if (userLogin.error?.message?.includes('verify your email')) {
      log('  Email not verified. Need to verify first.', 'yellow');
    } else if (userLogin.error?.message?.includes('Demographics')) {
      log('  Demographics not completed. Will skip regular user tests.', 'yellow');
    }
  }
}

async function createSpecialistProfile() {
  log('\n=== Creating Specialist Profile ===', 'blue');

  if (!specialistToken) {
    log('No specialist token available. Skipping profile creation.', 'yellow');
    return;
  }

  const profileData = {
    basic_info: {
      full_name: 'Dr. Sarah Ahmed',
      designation: 'Clinical Psychologist',
      location: 'Karachi, Pakistan',
      hourly_rate: 500,
      currency: 'PKR',
      specializations: ['CBT', 'Anxiety', 'Depression'],
      languages: ['English', 'Urdu'],
      categories: ['Mindfulness & Meditation', 'Life Coaching'],
      experience_years: 8,
      profile_photo: 'https://example.com/profile.jpg',
    },
    education: [
      {
        degree: 'Ph.D. in Clinical Psychology',
        institute_name: 'University of Karachi',
      },
    ],
    certifications: [
      {
        certificate_title: 'Licensed Clinical Psychologist',
        provider: 'Pakistan Psychological Association',
      },
    ],
  };

  const result = await testEndpoint(
    'Create Specialist Profile',
    'POST',
    '/specialist/profile',
    profileData,
    specialistToken
  );

  if (result.success) {
    log('✓ Specialist profile created', 'green');
  } else {
    log(`✗ Failed: ${JSON.stringify(result.error)}`, 'red');
    if (result.error?.message?.includes('already exists')) {
      log('  Profile already exists, continuing...', 'yellow');
    } else {
      throw new Error('Failed to create specialist profile');
    }
  }
}

async function testArticleEndpoints() {
  log('\n=== Testing Article Endpoints ===', 'blue');

  // Test 1: Get Categories (Public)
  log('\n1. GET /articles/categories (Public)', 'yellow');
  const categories = await testEndpoint('Get Categories', 'GET', '/articles/categories');
  if (categories.success) {
    log('✓ Success', 'green');
    log(`  Categories: ${JSON.stringify(categories.data.data)}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(categories.error)}`, 'red');
  }

  // Test 2: Create Article (Specialist only)
  log('\n2. POST /articles (Create Article - Specialist)', 'yellow');
  if (!specialistToken) {
    log('✗ No specialist token available', 'red');
  } else {
    const articleData = {
      title: 'Small Victory: I talked to someone today',
      category: 'Meditation',
      content: 'This is a comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this article, we will explore different meditation styles and how to get started with your practice.',
      featured_image_url: 'https://example.com/article-image.jpg',
      status: 'draft',
    };

    const createResult = await testEndpoint(
      'Create Article',
      'POST',
      '/articles',
      articleData,
      specialistToken
    );

    if (createResult.success) {
      log('✓ Article created', 'green');
      createdArticleId = createResult.data.data._id;
      log(`  Article ID: ${createdArticleId}`, 'blue');
      log(`  Title: ${createResult.data.data.title}`, 'blue');
      log(`  Status: ${createResult.data.data.status}`, 'blue');
    } else {
      log(`✗ Failed: ${JSON.stringify(createResult.error)}`, 'red');
    }
  }

  // Test 3: Create Another Article (Published)
  log('\n3. POST /articles (Create Published Article)', 'yellow');
  if (specialistToken) {
    const publishedArticle = {
      title: 'Understanding Exercise and Mental Health',
      category: 'Exercise',
      content: 'Regular exercise is one of the most effective ways to improve mental health. Physical activity releases endorphins, which are natural mood lifters. This article explores the connection between exercise and mental well-being, providing practical tips for incorporating exercise into your daily routine. We will discuss different types of exercises and their specific benefits for mental health.',
      featured_image_url: 'https://example.com/exercise.jpg',
      status: 'published',
    };

    const publishedResult = await testEndpoint(
      'Create Published Article',
      'POST',
      '/articles',
      publishedArticle,
      specialistToken
    );

    if (publishedResult.success) {
      log('✓ Published article created', 'green');
      log(`  Article ID: ${publishedResult.data.data._id}`, 'blue');
    } else {
      log(`✗ Failed: ${JSON.stringify(publishedResult.error)}`, 'red');
    }
  }

  // Test 4: Get My Articles (Specialist)
  log('\n4. GET /articles/my-articles (Specialist)', 'yellow');
  if (specialistToken) {
    const myArticles = await testEndpoint(
      'Get My Articles',
      'GET',
      '/articles/my-articles?status=all&page=1&limit=10',
      null,
      specialistToken
    );

    if (myArticles.success) {
      log('✓ Success', 'green');
      log(`  Total Articles: ${myArticles.data.pagination.total}`, 'blue');
      log(`  Published Count: ${myArticles.data.published_count}`, 'blue');
      log(`  Articles: ${myArticles.data.data.length}`, 'blue');
    } else {
      log(`✗ Failed: ${JSON.stringify(myArticles.error)}`, 'red');
    }
  }

  // Test 5: Get All Published Articles (Public)
  log('\n5. GET /articles (Public - All Published)', 'yellow');
  const allArticles = await testEndpoint('Get All Articles', 'GET', '/articles?page=1&limit=10');
  if (allArticles.success) {
    log('✓ Success', 'green');
    log(`  Total: ${allArticles.data.pagination.total}`, 'blue');
    log(`  Articles: ${allArticles.data.data.length}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(allArticles.error)}`, 'red');
  }

  // Test 6: Get Articles by Category
  log('\n6. GET /articles?category=Meditation (Public)', 'yellow');
  const categoryArticles = await testEndpoint(
    'Get Articles by Category',
    'GET',
    '/articles?category=Meditation&page=1&limit=10'
  );
  if (categoryArticles.success) {
    log('✓ Success', 'green');
    log(`  Total: ${categoryArticles.data.pagination.total}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(categoryArticles.error)}`, 'red');
  }

  // Test 7: Get Featured Articles
  log('\n7. GET /articles/featured (Public)', 'yellow');
  const featured = await testEndpoint('Get Featured Articles', 'GET', '/articles/featured?limit=6');
  if (featured.success) {
    log('✓ Success', 'green');
    log(`  Featured Articles: ${featured.data.data.length}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(featured.error)}`, 'red');
  }

  // Test 8: Search Articles
  log('\n8. GET /articles/search?q=meditation (Public)', 'yellow');
  const search = await testEndpoint('Search Articles', 'GET', '/articles/search?q=meditation');
  if (search.success) {
    log('✓ Success', 'green');
    log(`  Results: ${search.data.count}`, 'blue');
  } else {
    log(`✗ Failed: ${JSON.stringify(search.error)}`, 'red');
  }

  // Test 9: Get Article by ID (if we have one)
  if (createdArticleId) {
    log('\n9. GET /articles/:id (Public)', 'yellow');
    // First publish it
    log('  Publishing article first...', 'blue');
    const publishResult = await testEndpoint(
      'Publish Article',
      'PATCH',
      `/articles/${createdArticleId}/publish`,
      null,
      specialistToken
    );

    if (publishResult.success) {
      log('✓ Article published', 'green');
    }

    // Now get it
    const getArticle = await testEndpoint('Get Article', 'GET', `/articles/${createdArticleId}`);
    if (getArticle.success) {
      log('✓ Success', 'green');
      log(`  Title: ${getArticle.data.data.title}`, 'blue');
      log(`  Author: ${getArticle.data.data.author.name}`, 'blue');
      log(`  Views: ${getArticle.data.data.views}`, 'blue');
    } else {
      log(`✗ Failed: ${JSON.stringify(getArticle.error)}`, 'red');
    }
  }

  // Test 10: Update Article (Specialist)
  if (createdArticleId && specialistToken) {
    log('\n10. PUT /articles/:id (Update Article - Specialist)', 'yellow');
    const updateData = {
      title: 'Updated: Small Victory: I talked to someone today',
      content: 'This is an updated comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this updated article, we will explore different meditation styles and how to get started with your practice.',
    };

    const updateResult = await testEndpoint(
      'Update Article',
      'PUT',
      `/articles/${createdArticleId}`,
      updateData,
      specialistToken
    );

    if (updateResult.success) {
      log('✓ Article updated', 'green');
      log(`  New Title: ${updateResult.data.data.title}`, 'blue');
    } else {
      log(`✗ Failed: ${JSON.stringify(updateResult.error)}`, 'red');
    }
  }

  // Test 11: Try to create article as regular user (should fail)
  log('\n11. POST /articles (Regular User - Should Fail)', 'yellow');
  if (regularUserToken) {
    const regularUserArticle = await testEndpoint(
      'Create Article as Regular User',
      'POST',
      '/articles',
      {
        title: 'Test Article',
        category: 'Exercise',
        content: 'This should fail because regular users cannot create articles.',
      },
      regularUserToken
    );

    if (!regularUserArticle.success) {
      log('✓ Correctly rejected (regular users cannot create articles)', 'green');
    } else {
      log('✗ Should have failed but succeeded', 'red');
    }
  } else {
    log('  Skipped (no regular user token)', 'yellow');
  }

  // Test 12: Delete Article (Specialist)
  if (createdArticleId && specialistToken) {
    log('\n12. DELETE /articles/:id (Delete Article - Specialist)', 'yellow');
    const deleteResult = await testEndpoint(
      'Delete Article',
      'DELETE',
      `/articles/${createdArticleId}`,
      null,
      specialistToken
    );

    if (deleteResult.success) {
      log('✓ Article deleted', 'green');
    } else {
      log(`✗ Failed: ${JSON.stringify(deleteResult.error)}`, 'red');
    }
  }
}

async function runTests() {
  try {
    log('\n╔════════════════════════════════════════╗', 'blue');
    log('║   Article API Endpoint Testing Suite   ║', 'blue');
    log('╚════════════════════════════════════════╝', 'blue');

    await createTestUsers();
    await loginUsers();
    await createSpecialistProfile();
    await testArticleEndpoints();

    log('\n╔════════════════════════════════════════╗', 'green');
    log('║        All Tests Completed!             ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
  } catch (error) {
    log(`\n✗ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Check if axios is available
try {
  require('axios');
} catch (e) {
  console.error('Error: axios is not installed. Please run: npm install axios');
  process.exit(1);
}

runTests();

