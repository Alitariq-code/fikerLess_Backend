#!/bin/bash

# Test Suite for Forum Notifications with Facebook-style Messages
# Verifies that notifications include usernames properly

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="http://localhost:5002"
PASSED=0
FAILED=0

TEST_NUM=0

print_result() {
    local test_name=$1
    local status=$2
    local details=$3
    
    TEST_NUM=$((TEST_NUM + 1))
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓ Test $TEST_NUM: $test_name${NC}"
        [ -n "$details" ] && echo -e "  ${GREEN}  → $details${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ Test $TEST_NUM: $test_name${NC}"
        [ -n "$details" ] && echo -e "${RED}  → $details${NC}"
        FAILED=$((FAILED + 1))
    fi
}

api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: $token" \
                -d "$data"
        else
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Authorization: $token"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint"
        fi
    fi
}

echo "=========================================="
echo "Forum Notifications Test Suite"
echo "Facebook-Style Messages"
echo "=========================================="
echo ""

# Login as User 1 (Post Creator)
echo -e "${BLUE}=== Authentication Setup ===${NC}"
LOGIN_RESPONSE1=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"password123"}')
TOKEN1=$(echo $LOGIN_RESPONSE1 | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN1" ]; then
    echo -e "${RED}Failed to authenticate user 1${NC}"
    exit 1
fi
echo -e "${GREEN}✓ User 1 authenticated${NC}"

# Create a second user for testing
echo "Creating test user 2..."
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const MONGODB_URI = 'mongodb://localhost:27017/fikrless_db';
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  first_name: String,
  last_name: String,
  is_email_verified: Boolean,
  has_demographics: Boolean,
  user_type: String,
}, { timestamps: true });
const User = mongoose.model('User', userSchema, 'users');

(async () => {
  await mongoose.connect(MONGODB_URI);
  const password = await bcrypt.hash('password123', 10);
  await User.findOneAndUpdate(
    { email: 'user2@test.com' },
    {
      email: 'user2@test.com',
      password: password,
      first_name: 'John',
      last_name: 'Doe',
      is_email_verified: true,
      has_demographics: true,
      user_type: 'user',
    },
    { upsert: true, new: true }
  );
  console.log('User 2 created');
  await mongoose.disconnect();
})();
" 2>/dev/null

# Login as User 2 (Liker/Commenter)
LOGIN_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user2@test.com","password":"password123"}')
TOKEN2=$(echo $LOGIN_RESPONSE2 | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN2" ]; then
    echo -e "${YELLOW}⚠ User 2 not found, creating...${NC}"
    sleep 2
    LOGIN_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"user2@test.com","password":"password123"}')
    TOKEN2=$(echo $LOGIN_RESPONSE2 | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN2" ]; then
    echo -e "${RED}Failed to authenticate user 2. Using user 1 for all tests.${NC}"
    TOKEN2=$TOKEN1
else
    echo -e "${GREEN}✓ User 2 authenticated${NC}"
fi
echo ""

# Create a test post with User 1
echo -e "${BLUE}=== Creating Test Post ===${NC}"
POST_DATA='{"title":"Test Post for Notifications","description":"This is a test post to verify notification messages include usernames properly.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
POST_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$POST_ID" ]; then
    echo -e "${RED}Failed to create test post${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Test post created: ${POST_ID:0:10}...${NC}"
echo ""

# ============================================
# TEST SUITE: LIKE NOTIFICATIONS
# ============================================
echo -e "${BLUE}=== Test Suite: Like Notifications ===${NC}"

# Like the post with User 2
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Like Post - User 2 likes User 1's post" "PASS" "Like successful"
    
    # Wait a moment for notification to be created
    sleep 2
    
    # Check notifications for User 1
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    # Check if notification exists and has username
    if echo "$BODY" | grep -q "liked your post" || echo "$BODY" | grep -q "forum_like"; then
        NOTIFICATION_TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4)
        NOTIFICATION_BODY=$(echo "$BODY" | grep -o '"body":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4)
        
        if echo "$NOTIFICATION_TITLE" | grep -q -v "Someone"; then
            print_result "Like Notification - Title includes username" "PASS" "Title: $NOTIFICATION_TITLE"
        else
            print_result "Like Notification - Title includes username" "FAIL" "Title still says 'Someone'"
        fi
        
        if echo "$NOTIFICATION_BODY" | grep -q -v "Someone"; then
            print_result "Like Notification - Body includes username" "PASS" "Body: ${NOTIFICATION_BODY:0:60}..."
        else
            print_result "Like Notification - Body includes username" "FAIL" "Body still says 'Someone'"
        fi
        
        # Check metadata
        if echo "$BODY" | grep -q "liker_name"; then
            print_result "Like Notification - Metadata includes liker_name" "PASS" "Metadata present"
        else
            print_result "Like Notification - Metadata includes liker_name" "WARN" "Metadata may not include name"
        fi
    else
        print_result "Like Notification - Notification created" "FAIL" "Notification not found"
    fi
else
    print_result "Like Post - User 2 likes User 1's post" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE: COMMENT NOTIFICATIONS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite: Comment Notifications ===${NC}"

# Comment on the post with User 2
COMMENT_DATA='{"content":"This is a test comment to verify notification messages.","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN2")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "201" ]; then
    print_result "Create Comment - User 2 comments on User 1's post" "PASS" "Comment created"
    
    # Wait a moment for notification to be created
    sleep 2
    
    # Check notifications for User 1
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    # Check if notification exists and has username
    if echo "$BODY" | grep -q "commented on your post" || echo "$BODY" | grep -q "forum_comment"; then
        NOTIFICATION_TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*commented on your post[^"]*' | head -1 | cut -d'"' -f4)
        NOTIFICATION_BODY=$(echo "$BODY" | grep -o '"body":"[^"]*:[^"]*"' | head -1 | cut -d'"' -f4)
        
        if echo "$NOTIFICATION_TITLE" | grep -q -v "Someone\|New comment"; then
            print_result "Comment Notification - Title includes username" "PASS" "Title: $NOTIFICATION_TITLE"
        else
            print_result "Comment Notification - Title includes username" "FAIL" "Title: $NOTIFICATION_TITLE"
        fi
        
        if echo "$NOTIFICATION_BODY" | grep -q ":"; then
            print_result "Comment Notification - Body shows commenter name and preview" "PASS" "Body: ${NOTIFICATION_BODY:0:60}..."
        else
            print_result "Comment Notification - Body shows commenter name and preview" "FAIL" "Body format incorrect"
        fi
        
        # Check metadata
        if echo "$BODY" | grep -q "commenter_name"; then
            print_result "Comment Notification - Metadata includes commenter_name" "PASS" "Metadata present"
        else
            print_result "Comment Notification - Metadata includes commenter_name" "WARN" "Metadata may not include name"
        fi
    else
        print_result "Comment Notification - Notification created" "FAIL" "Notification not found"
    fi
else
    print_result "Create Comment - User 2 comments on User 1's post" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE: NO SELF-NOTIFICATIONS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite: No Self-Notifications ===${NC}"

# Get initial notification count
RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
INITIAL_COUNT=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2)

# User 1 likes their own post
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    sleep 1
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    NEW_COUNT=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2)
    
    if [ "$NEW_COUNT" == "$INITIAL_COUNT" ]; then
        print_result "Self-Like - No notification sent for own post" "PASS" "Count unchanged: $INITIAL_COUNT"
    else
        print_result "Self-Like - No notification sent for own post" "FAIL" "Count changed: $INITIAL_COUNT → $NEW_COUNT"
    fi
fi

# User 1 comments on their own post
COMMENT_DATA='{"content":"This is my own comment on my post.","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "201" ]; then
    sleep 1
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    FINAL_COUNT=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2)
    
    if [ "$FINAL_COUNT" == "$NEW_COUNT" ]; then
        print_result "Self-Comment - No notification sent for own comment" "PASS" "Count unchanged: $NEW_COUNT"
    else
        print_result "Self-Comment - No notification sent for own comment" "FAIL" "Count changed: $NEW_COUNT → $FINAL_COUNT"
    fi
fi

# ============================================
# FINAL SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All notification tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Notification Message Examples:${NC}"
    echo -e "${GREEN}Like:${NC} \"John Doe liked your post\""
    echo -e "${GREEN}Comment:${NC} \"John Doe commented on your post\""
    echo -e "${GREEN}Comment Body:${NC} \"John Doe: 'This is a test comment...'\""
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review output above.${NC}"
    exit 1
fi

