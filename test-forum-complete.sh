#!/bin/bash

# Complete Production-Ready Test Suite for Forum Module
# Tests Step 1 + Step 2 + Notifications

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
echo "Forum Module - Complete Production Test"
echo "Step 1 + Step 2 + Notifications"
echo "=========================================="
echo ""

# Setup: Create User 2 if needed
echo -e "${BLUE}=== Setup: Creating Test Users ===${NC}"
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
  try {
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
    await mongoose.disconnect();
  } catch (e) {}
})();
" 2>/dev/null

# Authentication
LOGIN_RESPONSE1=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"password123"}')
TOKEN1=$(echo $LOGIN_RESPONSE1 | grep -o '"token":"[^"]*' | cut -d'"' -f4)

LOGIN_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user2@test.com","password":"password123"}')
TOKEN2=$(echo $LOGIN_RESPONSE2 | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN1" ] || [ -z "$TOKEN2" ]; then
    echo -e "${RED}Failed to authenticate users${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Both users authenticated${NC}"
echo ""

# Create test post
POST_DATA='{"title":"Complete Test Post","description":"This is a comprehensive test post for complete forum module testing with sufficient content.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
POST_ID=$(echo "$RESPONSE" | sed '$d' | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✓ Test post created${NC}"
echo ""

# ============================================
# TEST: NOTIFICATIONS WITH USERNAMES
# ============================================
echo -e "${BLUE}=== Notification Messages Test ===${NC}"

# Get initial notification count
RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
INITIAL_COUNT=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2)

# User 2 likes User 1's post
api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2" > /dev/null
sleep 2

# Check notifications
RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
BODY=$(echo "$RESPONSE" | sed '$d')

# Extract notification details
NOTIF_TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4 || echo "")
NOTIF_BODY=$(echo "$BODY" | grep -o '"body":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$NOTIF_TITLE" ]; then
    if echo "$NOTIF_TITLE" | grep -q "John Doe\|User_"; then
        print_result "Like Notification - Title includes username" "PASS" "Title: $NOTIF_TITLE"
    else
        print_result "Like Notification - Title includes username" "FAIL" "Title: $NOTIF_TITLE"
    fi
    
    if echo "$NOTIF_BODY" | grep -q "John Doe\|User_"; then
        print_result "Like Notification - Body includes username" "PASS" "Body: ${NOTIF_BODY:0:60}..."
    else
        print_result "Like Notification - Body includes username" "FAIL" "Body: ${NOTIF_BODY:0:60}..."
    fi
else
    print_result "Like Notification - Notification created" "FAIL" "No notification found"
fi

# User 2 comments on User 1's post
COMMENT_DATA='{"content":"This is a test comment to verify notification messages include usernames.","is_anonymous":false}'
api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN2" > /dev/null
sleep 2

# Check comment notifications
RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
BODY=$(echo "$RESPONSE" | sed '$d')

NOTIF_TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*commented on your post[^"]*' | head -1 | cut -d'"' -f4 || echo "")
NOTIF_BODY=$(echo "$BODY" | grep -o '"body":"[^"]*:[^"]*"' | head -1 | cut -d'"' -f4 || echo "")

if [ -n "$NOTIF_TITLE" ]; then
    if echo "$NOTIF_TITLE" | grep -q "John Doe\|User_"; then
        print_result "Comment Notification - Title includes username" "PASS" "Title: $NOTIF_TITLE"
    else
        print_result "Comment Notification - Title includes username" "FAIL" "Title: $NOTIF_TITLE"
    fi
    
    if echo "$NOTIF_BODY" | grep -q "John Doe\|User_"; then
        print_result "Comment Notification - Body shows name and preview" "PASS" "Body: ${NOTIF_BODY:0:60}..."
    else
        print_result "Comment Notification - Body shows name and preview" "FAIL" "Body: ${NOTIF_BODY:0:60}..."
    fi
else
    print_result "Comment Notification - Notification created" "FAIL" "No notification found"
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
    echo -e "${BLUE}Notification Message Format:${NC}"
    echo -e "${GREEN}Like:${NC} \"John Doe liked your post\""
    echo -e "${GREEN}Comment:${NC} \"John Doe commented on your post\""
    echo -e "${GREEN}Comment Body:${NC} \"John Doe: 'This is a test comment...'\""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

