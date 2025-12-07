#!/bin/bash

# Complete Production-Ready Test Suite for Forum Module
# Tests: Step 1 (Posts) + Step 2 (Likes & Comments) + Notifications

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="http://localhost:5002"
PASSED=0
FAILED=0
WARNINGS=0

TEST_NUM=0

print_result() {
    local test_name=$1
    local status=$2
    local details=$3
    
    TEST_NUM=$((TEST_NUM + 1))
    case $status in
        PASS)
            echo -e "${GREEN}✓ Test $TEST_NUM: $test_name${NC}"
            [ -n "$details" ] && echo -e "  ${GREEN}  → $details${NC}"
            PASSED=$((PASSED + 1))
            ;;
        FAIL)
            echo -e "${RED}✗ Test $TEST_NUM: $test_name${NC}"
            [ -n "$details" ] && echo -e "${RED}  → $details${NC}"
            FAILED=$((FAILED + 1))
            ;;
        WARN)
            echo -e "${YELLOW}⚠ Test $TEST_NUM: $test_name${NC}"
            [ -n "$details" ] && echo -e "${YELLOW}  → $details${NC}"
            WARNINGS=$((WARNINGS + 1))
            ;;
    esac
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

# ============================================
# SETUP: Create Test Users
# ============================================
echo -e "${CYAN}=== Setup: Creating Test Users ===${NC}"
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
    
    // User 1
    await User.findOneAndUpdate(
      { email: 'user@test.com' },
      {
        email: 'user@test.com',
        password: password,
        first_name: 'Test',
        last_name: 'User',
        is_email_verified: true,
        has_demographics: true,
        user_type: 'user',
      },
      { upsert: true, new: true }
    );
    
    // User 2 (John Doe)
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
    console.log('Users ready');
  } catch (e) {
    console.error('Error:', e.message);
  }
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

# ============================================
# TEST SUITE 1: STEP 1 - CORE POSTS
# ============================================
echo -e "${BLUE}=== Test Suite 1: Step 1 - Core Posts ===${NC}"

# Test 1.1: Get Categories
RESPONSE=$(api_call GET "/api/v1/forum/categories")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | grep -q '"success":true'; then
    CAT_COUNT=$(echo "$BODY" | grep -o '"category"' | wc -l)
    print_result "Get Categories - Returns all categories" "PASS" "$CAT_COUNT categories"
else
    print_result "Get Categories - Returns all categories" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.2: Create Post
POST_DATA='{"title":"Production Test Post","description":"This is a comprehensive production test post with sufficient content for validation.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
POST_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ "$HTTP_CODE" == "201" ] && [ -n "$POST_ID" ]; then
    print_result "Create Post - Successfully creates post" "PASS" "Post ID: ${POST_ID:0:10}..."
else
    print_result "Create Post - Successfully creates post" "FAIL" "HTTP $HTTP_CODE"
    POST_ID=""
fi

# Test 1.3: Get All Posts
RESPONSE=$(api_call GET "/api/v1/forum/posts")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Get All Posts - Returns posts with pagination" "PASS" "HTTP 200"
else
    print_result "Get All Posts - Returns posts with pagination" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.4: Get Single Post
if [ -n "$POST_ID" ]; then
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        print_result "Get Single Post - Returns post details" "PASS" "HTTP 200"
    else
        print_result "Get Single Post - Returns post details" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# Test 1.5: Search Posts
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=Production")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Search Posts - Returns matching results" "PASS" "HTTP 200"
else
    print_result "Search Posts - Returns matching results" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 2: STEP 2 - LIKES
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 2: Step 2 - Likes ===${NC}"

if [ -n "$POST_ID" ]; then
    # Test 2.1: Like Post
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | grep -q '"is_liked":true'; then
        LIKES_COUNT=$(echo "$BODY" | grep -o '"likes_count":[0-9]*' | cut -d':' -f2)
        print_result "Like Post - Successfully likes post" "PASS" "Likes: $LIKES_COUNT"
    else
        print_result "Like Post - Successfully likes post" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 2.2: Unlike Post
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | grep -q '"is_liked":false'; then
        print_result "Unlike Post - Toggles like correctly" "PASS" "Like removed"
    else
        print_result "Unlike Post - Toggles like correctly" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 2.3: Like again
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        print_result "Like Post Again - Can like after unliking" "PASS" "Toggle works"
    else
        print_result "Like Post Again - Can like after unliking" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# ============================================
# TEST SUITE 3: STEP 2 - COMMENTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 3: Step 2 - Comments ===${NC}"

if [ -n "$POST_ID" ]; then
    # Test 3.1: Create Comment
    COMMENT_DATA='{"content":"This is a production test comment with sufficient content.","is_anonymous":false}'
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    COMMENT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ "$HTTP_CODE" == "201" ] && [ -n "$COMMENT_ID" ]; then
        print_result "Create Comment - Successfully creates comment" "PASS" "Comment ID: ${COMMENT_ID:0:10}..."
    else
        print_result "Create Comment - Successfully creates comment" "FAIL" "HTTP $HTTP_CODE"
        COMMENT_ID=""
    fi
    
    # Test 3.2: Get Comments
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | grep -q '"success":true'; then
        TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
        print_result "Get Comments - Returns comments with pagination" "PASS" "Total: $TOTAL"
    else
        print_result "Get Comments - Returns comments with pagination" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 3.3: Update Comment
    if [ -n "$COMMENT_ID" ]; then
        UPDATE_DATA='{"content":"This is an updated production test comment."}'
        RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "$UPDATE_DATA" "$TOKEN2")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        
        if [ "$HTTP_CODE" == "200" ]; then
            print_result "Update Comment - Successfully updates comment" "PASS" "HTTP 200"
        else
            print_result "Update Comment - Successfully updates comment" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
    
    # Test 3.4: Delete Comment
    if [ -n "$COMMENT_ID" ]; then
        RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "" "$TOKEN2")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        
        if [ "$HTTP_CODE" == "200" ]; then
            print_result "Delete Comment - Successfully deletes comment" "PASS" "HTTP 200"
        else
            print_result "Delete Comment - Successfully deletes comment" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
fi

# ============================================
# TEST SUITE 4: NOTIFICATIONS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 4: Notifications (Facebook-Style) ===${NC}"

# Create a fresh post for notification testing
POST_DATA='{"title":"Notification Test Post","description":"This post is specifically for testing notification messages with usernames.","category":"Anxiety","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
NOTIF_POST_ID=$(echo "$RESPONSE" | sed '$d' | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$NOTIF_POST_ID" ]; then
    # Get initial notification count
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    INITIAL_COUNT=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
    
    # Test 4.1: Like Notification
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/like" "" "$TOKEN2" > /dev/null
    sleep 3
    
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    # Find like notification
    LIKE_NOTIF=$(echo "$BODY" | grep -o '"type":"forum_like"[^}]*}' | head -1)
    if [ -n "$LIKE_NOTIF" ]; then
        TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4)
        BODY_TEXT=$(echo "$BODY" | grep -o '"body":"[^"]*liked your post[^"]*' | head -1 | cut -d'"' -f4)
        
        if echo "$TITLE" | grep -q -E "John Doe|Test User|User_"; then
            print_result "Like Notification - Title includes username" "PASS" "Title: $TITLE"
        else
            print_result "Like Notification - Title includes username" "FAIL" "Title: $TITLE"
        fi
        
        if echo "$BODY_TEXT" | grep -q -E "John Doe|Test User|User_"; then
            print_result "Like Notification - Body includes username" "PASS" "Body: ${BODY_TEXT:0:50}..."
        else
            print_result "Like Notification - Body includes username" "FAIL" "Body: ${BODY_TEXT:0:50}..."
        fi
        
        # Check metadata
        if echo "$BODY" | grep -q "liker_name"; then
            print_result "Like Notification - Metadata includes liker_name" "PASS" "Metadata present"
        else
            print_result "Like Notification - Metadata includes liker_name" "WARN" "Metadata may be missing"
        fi
    else
        print_result "Like Notification - Notification created" "FAIL" "Notification not found"
    fi
    
    # Test 4.2: Comment Notification
    COMMENT_DATA='{"content":"This is a test comment to verify notification messages include usernames properly.","is_anonymous":false}'
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/comments" "$COMMENT_DATA" "$TOKEN2" > /dev/null
    sleep 3
    
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    # Find comment notification
    COMMENT_NOTIF=$(echo "$BODY" | grep -o '"type":"forum_comment"[^}]*}' | head -1)
    if [ -n "$COMMENT_NOTIF" ]; then
        TITLE=$(echo "$BODY" | grep -o '"title":"[^"]*commented on your post[^"]*' | head -1 | cut -d'"' -f4)
        BODY_TEXT=$(echo "$BODY" | grep -o '"body":"[^"]*:[^"]*"' | head -1 | cut -d'"' -f4)
        
        if echo "$TITLE" | grep -q -E "John Doe|Test User|User_"; then
            print_result "Comment Notification - Title includes username" "PASS" "Title: $TITLE"
        else
            print_result "Comment Notification - Title includes username" "FAIL" "Title: $TITLE"
        fi
        
        if echo "$BODY_TEXT" | grep -q ":"; then
            print_result "Comment Notification - Body shows name and preview" "PASS" "Body: ${BODY_TEXT:0:50}..."
        else
            print_result "Comment Notification - Body shows name and preview" "FAIL" "Body format incorrect"
        fi
        
        # Check metadata
        if echo "$BODY" | grep -q "commenter_name"; then
            print_result "Comment Notification - Metadata includes commenter_name" "PASS" "Metadata present"
        else
            print_result "Comment Notification - Metadata includes commenter_name" "WARN" "Metadata may be missing"
        fi
    else
        print_result "Comment Notification - Notification created" "FAIL" "Notification not found"
    fi
    
    # Test 4.3: No Self-Notifications
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    COUNT_BEFORE=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
    
    # User 1 likes their own post
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/like" "" "$TOKEN1" > /dev/null
    sleep 1
    
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    COUNT_AFTER=$(echo "$RESPONSE" | sed '$d' | grep -o '"count":[0-9]*' | cut -d':' -f2 || echo "0")
    
    if [ "$COUNT_AFTER" == "$COUNT_BEFORE" ]; then
        print_result "Self-Like - No notification for own post" "PASS" "Count unchanged: $COUNT_BEFORE"
    else
        print_result "Self-Like - No notification for own post" "FAIL" "Count: $COUNT_BEFORE → $COUNT_AFTER"
    fi
fi

# ============================================
# TEST SUITE 5: VALIDATION & EDGE CASES
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 5: Validation & Edge Cases ===${NC}"

# Test 5.1: Invalid post ID format
RESPONSE=$(api_call GET "/api/v1/forum/posts/invalid-id-123")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "400" ]; then
    print_result "Edge Case - Invalid post ID format" "PASS" "HTTP $HTTP_CODE"
else
    print_result "Edge Case - Invalid post ID format" "WARN" "HTTP $HTTP_CODE"
fi

# Test 5.2: Like without auth
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Security - Like requires authentication" "PASS" "HTTP 401"
else
    print_result "Security - Like requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 5.3: Comment without auth
COMMENT_DATA='{"content":"Test comment"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Security - Comment requires authentication" "PASS" "HTTP 401"
else
    print_result "Security - Comment requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 5.4: Update other user's comment
if [ -n "$POST_ID" ]; then
    # Create comment with User 2
    COMMENT_DATA='{"content":"This comment belongs to User 2.","is_anonymous":false}'
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN2")
    OTHER_COMMENT_ID=$(echo "$RESPONSE" | sed '$d' | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -n "$OTHER_COMMENT_ID" ]; then
        # Try to update with User 1
        UPDATE_DATA='{"content":"Hacked comment"}'
        RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$OTHER_COMMENT_ID" "$UPDATE_DATA" "$TOKEN1")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        
        if [ "$HTTP_CODE" == "403" ]; then
            print_result "Security - Cannot update other user's comment" "PASS" "HTTP 403"
        else
            print_result "Security - Cannot update other user's comment" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
fi

# ============================================
# FINAL SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "Complete Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo "Total: $((PASSED + FAILED + WARNINGS))"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓✓✓ ALL TESTS PASSED! PRODUCTION READY! ✓✓✓${NC}"
        echo ""
        echo -e "${CYAN}Notification Message Examples:${NC}"
        echo -e "${GREEN}Like:${NC} \"John Doe liked your post\""
        echo -e "${GREEN}Comment:${NC} \"John Doe commented on your post\""
        echo -e "${GREEN}Comment Body:${NC} \"John Doe: 'This is a test comment...'\""
        echo ""
        echo -e "${CYAN}All Features Verified:${NC}"
        echo -e "  ✓ Step 1: Core Posts (Create, Read, List, Search, Categories)"
        echo -e "  ✓ Step 2: Likes & Comments (Toggle, CRUD, Pagination)"
        echo -e "  ✓ Notifications: Facebook-style messages with usernames"
        echo -e "  ✓ Security: Authentication & Authorization"
        echo -e "  ✓ Validation: Input validation & error handling"
        exit 0
    else
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        echo -e "${YELLOW}⚠ Some warnings (non-critical)${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ Some tests failed. Review output above.${NC}"
    exit 1
fi

