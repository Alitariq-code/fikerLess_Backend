#!/bin/bash

BASE_URL="http://localhost:5002/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SPECIALIST_TOKEN=""
SPECIALIST_USER_ID=""
REGULAR_USER_TOKEN=""
CREATED_ARTICLE_ID=""

log() {
    echo -e "${2:-$NC}$1${NC}"
}

test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local token=$5
    
    local headers=(-H "Content-Type: application/json")
    if [ ! -z "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$BASE_URL$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$BASE_URL$url")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "$body"
        return 0
    else
        echo "ERROR:$http_code:$body"
        return 1
    fi
}

log "\n╔════════════════════════════════════════╗" "$BLUE"
log "║   Article API Endpoint Testing Suite   ║" "$BLUE"
log "╚════════════════════════════════════════╝" "$BLUE"

# Step 1: Create Test Users
log "\n=== Creating Test Users ===" "$BLUE"

log "\n1. Creating Specialist User..." "$YELLOW"
specialist_signup=$(test_endpoint "Signup Specialist" "POST" "/auth/signup" '{"email":"specialist@test.com","password":"password123","user_type":"specialist"}')
if echo "$specialist_signup" | grep -q "user_id"; then
    log "✓ Specialist user created" "$GREEN"
    SPECIALIST_USER_ID=$(echo "$specialist_signup" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)
    log "  User ID: $SPECIALIST_USER_ID" "$BLUE"
elif echo "$specialist_signup" | grep -q "already registered"; then
    log "  User already exists, continuing..." "$YELLOW"
else
    log "✗ Failed: $specialist_signup" "$RED"
fi

log "\n2. Creating Regular User..." "$YELLOW"
user_signup=$(test_endpoint "Signup User" "POST" "/auth/signup" '{"email":"user@test.com","password":"password123","user_type":"user"}')
if echo "$user_signup" | grep -q "user_id\|already registered"; then
    log "✓ Regular user created or already exists" "$GREEN"
else
    log "✗ Failed: $user_signup" "$RED"
fi

# Step 2: Get OTP from database (we'll need to check MongoDB)
log "\n=== Email Verification ===" "$BLUE"
log "Note: For testing, we need to get OTP from database" "$YELLOW"
log "Checking MongoDB for OTP tokens..." "$YELLOW"

# Try to get OTP from MongoDB
OTP=$(docker exec fikrless-mongodb mongosh fikrless_db --quiet --eval "db.users.findOne({email:'specialist@test.com'}, {otp_token:1})" 2>/dev/null | grep -o '"otp_token" : "[^"]*"' | cut -d'"' -f4 || echo "")

if [ ! -z "$OTP" ] && [ "$OTP" != "null" ] && [ "$OTP" != "" ]; then
    log "Found OTP: $OTP" "$BLUE"
    log "\n3. Verifying Specialist Email..." "$YELLOW"
    verify_result=$(test_endpoint "Verify Email" "POST" "/auth/email-verify" "{\"token\":\"$OTP\"}")
    if echo "$verify_result" | grep -q "token"; then
        log "✓ Email verified" "$GREEN"
        SPECIALIST_TOKEN=$(echo "$verify_result" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        log "  Token: ${SPECIALIST_TOKEN:0:20}..." "$BLUE"
    else
        log "✗ Verification failed: $verify_result" "$RED"
    fi
else
    log "  Could not get OTP from database. Trying login..." "$YELLOW"
fi

# Step 3: Login Users
log "\n=== Logging In Users ===" "$BLUE"

if [ -z "$SPECIALIST_TOKEN" ]; then
    log "\n1. Logging in Specialist..." "$YELLOW"
    login_result=$(test_endpoint "Login Specialist" "POST" "/auth/login" '{"email":"specialist@test.com","password":"password123"}')
    if echo "$login_result" | grep -q "token"; then
        SPECIALIST_TOKEN=$(echo "$login_result" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        SPECIALIST_USER_ID=$(echo "$login_result" | grep -o '"user_id":"[^"]*"' | cut -d'"' -f4)
        log "✓ Specialist logged in" "$GREEN"
        log "  Token: ${SPECIALIST_TOKEN:0:20}..." "$BLUE"
    elif echo "$login_result" | grep -q "verify your email"; then
        log "✗ Email not verified. Please verify email first." "$RED"
        log "  You can verify by checking the database for OTP token" "$YELLOW"
    elif echo "$login_result" | grep -q "complete your specialist profile"; then
        log "  Specialist profile not completed. Will create profile." "$YELLOW"
        # Continue without token for now
    else
        log "✗ Login failed: $login_result" "$RED"
    fi
fi

log "\n2. Logging in Regular User..." "$YELLOW"
user_login=$(test_endpoint "Login User" "POST" "/auth/login" '{"email":"user@test.com","password":"password123"}')
if echo "$user_login" | grep -q "token"; then
    REGULAR_USER_TOKEN=$(echo "$user_login" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    log "✓ Regular user logged in" "$GREEN"
elif echo "$user_login" | grep -q "Demographics"; then
    log "  Demographics not completed. Skipping regular user tests." "$YELLOW"
else
    log "  Login failed or email not verified: $user_login" "$YELLOW"
fi

# Step 4: Create Specialist Profile
log "\n=== Creating Specialist Profile ===" "$BLUE"
if [ ! -z "$SPECIALIST_TOKEN" ]; then
    profile_data='{
        "basic_info": {
            "full_name": "Dr. Sarah Ahmed",
            "designation": "Clinical Psychologist",
            "location": "Karachi, Pakistan",
            "hourly_rate": 500,
            "currency": "PKR",
            "specializations": ["CBT", "Anxiety", "Depression"],
            "languages": ["English", "Urdu"],
            "categories": ["Mindfulness & Meditation", "Life Coaching"],
            "experience_years": 8,
            "profile_photo": "https://example.com/profile.jpg"
        },
        "education": [{
            "degree": "Ph.D. in Clinical Psychology",
            "institute_name": "University of Karachi"
        }],
        "certifications": [{
            "certificate_title": "Licensed Clinical Psychologist",
            "provider": "Pakistan Psychological Association"
        }]
    }'
    
    profile_result=$(test_endpoint "Create Profile" "POST" "/specialist/profile" "$profile_data" "$SPECIALIST_TOKEN")
    if echo "$profile_result" | grep -q "success\|already exists"; then
        log "✓ Specialist profile created or already exists" "$GREEN"
    else
        log "✗ Failed: $profile_result" "$RED"
    fi
else
    log "  No specialist token available. Skipping profile creation." "$YELLOW"
fi

# Step 5: Test Article Endpoints
log "\n=== Testing Article Endpoints ===" "$BLUE"

log "\n1. GET /articles/categories (Public)" "$YELLOW"
categories=$(test_endpoint "Get Categories" "GET" "/articles/categories")
if echo "$categories" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    echo "$categories" | grep -o '\[.*\]' | head -1
else
    log "✗ Failed: $categories" "$RED"
fi

if [ ! -z "$SPECIALIST_TOKEN" ]; then
    log "\n2. POST /articles (Create Article - Specialist)" "$YELLOW"
    article_data='{
        "title": "Small Victory: I talked to someone today",
        "category": "Meditation",
        "content": "This is a comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this article, we will explore different meditation styles and how to get started with your practice.",
        "featured_image_url": "https://example.com/article-image.jpg",
        "status": "draft"
    }'
    
    create_result=$(test_endpoint "Create Article" "POST" "/articles" "$article_data" "$SPECIALIST_TOKEN")
    if echo "$create_result" | grep -q "_id"; then
        log "✓ Article created" "$GREEN"
        CREATED_ARTICLE_ID=$(echo "$create_result" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
        log "  Article ID: $CREATED_ARTICLE_ID" "$BLUE"
    else
        log "✗ Failed: $create_result" "$RED"
    fi
    
    log "\n3. POST /articles (Create Published Article)" "$YELLOW"
    published_article='{
        "title": "Understanding Exercise and Mental Health",
        "category": "Exercise",
        "content": "Regular exercise is one of the most effective ways to improve mental health. Physical activity releases endorphins, which are natural mood lifters. This article explores the connection between exercise and mental well-being, providing practical tips for incorporating exercise into your daily routine. We will discuss different types of exercises and their specific benefits for mental health.",
        "featured_image_url": "https://example.com/exercise.jpg",
        "status": "published"
    }'
    
    published_result=$(test_endpoint "Create Published" "POST" "/articles" "$published_article" "$SPECIALIST_TOKEN")
    if echo "$published_result" | grep -q "_id"; then
        log "✓ Published article created" "$GREEN"
    else
        log "✗ Failed: $published_result" "$RED"
    fi
    
    log "\n4. GET /articles/my-articles (Specialist)" "$YELLOW"
    my_articles=$(test_endpoint "Get My Articles" "GET" "/articles/my-articles?status=all&page=1&limit=10" "" "$SPECIALIST_TOKEN")
    if echo "$my_articles" | grep -q "success"; then
        log "✓ Success" "$GREEN"
        total=$(echo "$my_articles" | grep -o '"total":[0-9]*' | cut -d':' -f2)
        log "  Total Articles: $total" "$BLUE"
    else
        log "✗ Failed: $my_articles" "$RED"
    fi
fi

log "\n5. GET /articles (Public - All Published)" "$YELLOW"
all_articles=$(test_endpoint "Get All Articles" "GET" "/articles?page=1&limit=10")
if echo "$all_articles" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    total=$(echo "$all_articles" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    log "  Total: $total" "$BLUE"
else
    log "✗ Failed: $all_articles" "$RED"
fi

log "\n6. GET /articles?category=Meditation (Public)" "$YELLOW"
category_articles=$(test_endpoint "Get by Category" "GET" "/articles?category=Meditation&page=1&limit=10")
if echo "$category_articles" | grep -q "success"; then
    log "✓ Success" "$GREEN"
else
    log "✗ Failed: $category_articles" "$RED"
fi

log "\n7. GET /articles/featured (Public)" "$YELLOW"
featured=$(test_endpoint "Get Featured" "GET" "/articles/featured?limit=6")
if echo "$featured" | grep -q "success"; then
    log "✓ Success" "$GREEN"
else
    log "✗ Failed: $featured" "$RED"
fi

log "\n8. GET /articles/search?q=meditation (Public)" "$YELLOW"
search=$(test_endpoint "Search" "GET" "/articles/search?q=meditation")
if echo "$search" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    count=$(echo "$search" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    log "  Results: $count" "$BLUE"
else
    log "✗ Failed: $search" "$RED"
fi

if [ ! -z "$CREATED_ARTICLE_ID" ] && [ ! -z "$SPECIALIST_TOKEN" ]; then
    log "\n9. PATCH /articles/:id/publish (Publish Article)" "$YELLOW"
    publish_result=$(test_endpoint "Publish" "PATCH" "/articles/$CREATED_ARTICLE_ID/publish" "" "$SPECIALIST_TOKEN")
    if echo "$publish_result" | grep -q "success"; then
        log "✓ Article published" "$GREEN"
    else
        log "✗ Failed: $publish_result" "$RED"
    fi
    
    log "\n10. GET /articles/:id (Public)" "$YELLOW"
    get_article=$(test_endpoint "Get Article" "GET" "/articles/$CREATED_ARTICLE_ID")
    if echo "$get_article" | grep -q "success"; then
        log "✓ Success" "$GREEN"
        title=$(echo "$get_article" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4)
        log "  Title: $title" "$BLUE"
    else
        log "✗ Failed: $get_article" "$RED"
    fi
    
    log "\n11. PUT /articles/:id (Update Article)" "$YELLOW"
    update_data='{
        "title": "Updated: Small Victory: I talked to someone today",
        "content": "This is an updated comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this updated article, we will explore different meditation styles and how to get started with your practice."
    }'
    
    update_result=$(test_endpoint "Update" "PUT" "/articles/$CREATED_ARTICLE_ID" "$update_data" "$SPECIALIST_TOKEN")
    if echo "$update_result" | grep -q "success"; then
        log "✓ Article updated" "$GREEN"
    else
        log "✗ Failed: $update_result" "$RED"
    fi
    
    log "\n12. DELETE /articles/:id (Delete Article)" "$YELLOW"
    delete_result=$(test_endpoint "Delete" "DELETE" "/articles/$CREATED_ARTICLE_ID" "" "$SPECIALIST_TOKEN")
    if echo "$delete_result" | grep -q "success"; then
        log "✓ Article deleted" "$GREEN"
    else
        log "✗ Failed: $delete_result" "$RED"
    fi
fi

if [ ! -z "$REGULAR_USER_TOKEN" ]; then
    log "\n13. POST /articles (Regular User - Should Fail)" "$YELLOW"
    regular_article='{
        "title": "Test Article",
        "category": "Exercise",
        "content": "This should fail because regular users cannot create articles."
    }'
    
    regular_result=$(test_endpoint "Create as User" "POST" "/articles" "$regular_article" "$REGULAR_USER_TOKEN")
    if echo "$regular_result" | grep -q "ERROR:403\|Only specialists"; then
        log "✓ Correctly rejected (regular users cannot create articles)" "$GREEN"
    else
        log "✗ Should have failed: $regular_result" "$RED"
    fi
fi

log "\n╔════════════════════════════════════════╗" "$GREEN"
log "║        All Tests Completed!             ║" "$GREEN"
log "╚════════════════════════════════════════╝" "$GREEN"

