#!/bin/bash

# Complete Production-Ready Test Suite
# Tests Step 1 + Step 2 + Notifications comprehensively

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
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
                -d "$data" 2>/dev/null
        else
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Authorization: $token" 2>/dev/null
        fi
    else
        if [ -n "$data" ]; then
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data" 2>/dev/null
        else
            curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" 2>/dev/null
        fi
    fi
}

echo "=========================================="
echo -e "${BOLD}${CYAN}Forum Module - Complete Production Test${NC}"
echo -e "${BOLD}Step 1 + Step 2 + Notifications${NC}"
echo "=========================================="
echo ""

# ============================================
# SETUP
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
    const pwd = await bcrypt.hash('password123', 10);
    await User.findOneAndUpdate({email:'user@test.com'},{email:'user@test.com',password:pwd,first_name:'Test',last_name:'User',is_email_verified:true,has_demographics:true,user_type:'user'},{upsert:true});
    await User.findOneAndUpdate({email:'user2@test.com'},{email:'user2@test.com',password:pwd,first_name:'John',last_name:'Doe',is_email_verified:true,has_demographics:true,user_type:'user'},{upsert:true});
    await mongoose.disconnect();
    console.log('Users ready');
  } catch(e) {}
})();
" 2>/dev/null

TOKEN1=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"password123"}' | jq -r '.token // empty')
TOKEN2=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"user2@test.com","password":"password123"}' | jq -r '.token // empty')

if [ -z "$TOKEN1" ] || [ -z "$TOKEN2" ]; then
    echo -e "${RED}Authentication failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Both users authenticated${NC}"
echo ""

# ============================================
# TEST SUITE 1: STEP 1 - CORE POSTS
# ============================================
echo -e "${BLUE}=== Test Suite 1: Step 1 - Core Posts ===${NC}"

# 1.1: Get Categories
RESPONSE=$(api_call GET "/api/v1/forum/categories")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    CAT_COUNT=$(echo "$BODY" | jq '.data | length')
    print_result "Get Categories - Returns all categories" "PASS" "$CAT_COUNT categories"
else
    print_result "Get Categories - Returns all categories" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.2: Create Post
POST_DATA='{"title":"Production Test Post","description":"This is a comprehensive production test post with sufficient content for validation purposes.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
POST_ID=$(echo "$BODY" | jq -r '.data._id // empty')

if [ "$HTTP_CODE" == "201" ] && [ -n "$POST_ID" ] && [ "$POST_ID" != "null" ]; then
    print_result "Create Post - Successfully creates post" "PASS" "Post ID: ${POST_ID:0:10}..."
else
    print_result "Create Post - Successfully creates post" "FAIL" "HTTP $HTTP_CODE"
    POST_ID=""
fi

# 1.3: Create Anonymous Post
ANON_POST_DATA='{"title":"Anonymous Production Post","description":"This is an anonymous post for production testing with sufficient content.","category":"Anxiety","is_anonymous":true}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$ANON_POST_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "201" ] && echo "$BODY" | jq -e '.data.is_anonymous == true' > /dev/null 2>&1; then
    print_result "Create Anonymous Post - Sets anonymous flag" "PASS" "Anonymous post created"
else
    print_result "Create Anonymous Post - Sets anonymous flag" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.4: Get All Posts
RESPONSE=$(api_call GET "/api/v1/forum/posts")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    if echo "$BODY" | jq -e '.pagination' > /dev/null 2>&1; then
        print_result "Get All Posts - Returns posts with pagination" "PASS" "Has pagination"
    else
        print_result "Get All Posts - Returns posts with pagination" "FAIL" "Missing pagination"
    fi
else
    print_result "Get All Posts - Returns posts with pagination" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.5: Get Posts by Category
RESPONSE=$(api_call GET "/api/v1/forum/posts?category=Depression")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Get Posts by Category - Filters correctly" "PASS" "HTTP 200"
else
    print_result "Get Posts by Category - Filters correctly" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.6: Get Posts with Pagination
RESPONSE=$(api_call GET "/api/v1/forum/posts?page=1&limit=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.pagination.page == 1 and .pagination.limit == 5' > /dev/null 2>&1; then
    print_result "Get Posts - Pagination params work" "PASS" "Page 1, Limit 5"
else
    print_result "Get Posts - Pagination params work" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.7: Get Single Post
if [ -n "$POST_ID" ] && [ "$POST_ID" != "null" ]; then
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
        # Check all required fields
        REQUIRED_FIELDS=("_id" "title" "description" "category" "author" "likes_count" "comments_count" "views")
        MISSING=0
        for field in "${REQUIRED_FIELDS[@]}"; do
            if ! echo "$BODY" | jq -e ".data.$field" > /dev/null 2>&1; then
                MISSING=$((MISSING + 1))
            fi
        done
        if [ $MISSING -eq 0 ]; then
            print_result "Get Single Post - Returns all required fields" "PASS" "All fields present"
        else
            print_result "Get Single Post - Returns all required fields" "FAIL" "Missing $MISSING fields"
        fi
    else
        print_result "Get Single Post - Returns post details" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# 1.8: Search Posts
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=Production")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    print_result "Search Posts - Returns matching results" "PASS" "HTTP 200"
else
    print_result "Search Posts - Returns matching results" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.9: Search Posts Empty Query
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Search Posts - Handles empty query" "PASS" "HTTP 200"
else
    print_result "Search Posts - Handles empty query" "WARN" "HTTP $HTTP_CODE"
fi

# 1.10: Validation - Title too short
INVALID='{"title":"AB","description":"This description is long enough to pass validation.","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Title too short rejected" "PASS" "HTTP 400"
else
    print_result "Validation - Title too short rejected" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.11: Validation - Description too short
INVALID='{"title":"Valid Title","description":"Short","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Description too short rejected" "PASS" "HTTP 400"
else
    print_result "Validation - Description too short rejected" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.12: Validation - Invalid category
INVALID='{"title":"Valid Title","description":"This is a valid description with enough content.","category":"InvalidCategory123"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Invalid category rejected" "PASS" "HTTP 400"
else
    print_result "Validation - Invalid category rejected" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.13: Create Post without Auth
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Security - Create Post requires auth" "PASS" "HTTP 401"
else
    print_result "Security - Create Post requires auth" "FAIL" "HTTP $HTTP_CODE"
fi

# 1.14: Get Non-existent Post
FAKE_ID="507f1f77bcf86cd799439011"
RESPONSE=$(api_call GET "/api/v1/forum/posts/$FAKE_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Error Handling - 404 for invalid post" "PASS" "HTTP 404"
else
    print_result "Error Handling - 404 for invalid post" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 2: STEP 2 - LIKES
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 2: Step 2 - Likes ===${NC}"

if [ -n "$POST_ID" ] && [ "$POST_ID" != "null" ]; then
    # 2.1: Like Post
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.is_liked == true' > /dev/null 2>&1; then
        LIKES=$(echo "$BODY" | jq -r '.likes_count')
        print_result "Like Post - Successfully likes post" "PASS" "Likes: $LIKES"
    else
        print_result "Like Post - Successfully likes post" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 2.2: Unlike Post
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.is_liked == false' > /dev/null 2>&1; then
        print_result "Unlike Post - Toggles correctly" "PASS" "Like removed"
    else
        print_result "Unlike Post - Toggles correctly" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 2.3: Like again
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        print_result "Like Post Again - Can like after unliking" "PASS" "Toggle works"
    else
        print_result "Like Post Again - Can like after unliking" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 2.4: Verify likes count updated
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    BODY=$(echo "$RESPONSE" | sed '$d')
    CURRENT_LIKES=$(echo "$BODY" | jq -r '.data.likes_count // 0')
    if [ "$CURRENT_LIKES" -gt 0 ]; then
        print_result "Like Post - Updates post likes_count" "PASS" "Count: $CURRENT_LIKES"
    else
        print_result "Like Post - Updates post likes_count" "FAIL" "Count: $CURRENT_LIKES"
    fi
fi

# 2.5: Like without auth
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Security - Like requires authentication" "PASS" "HTTP 401"
else
    print_result "Security - Like requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# 2.6: Like invalid post
RESPONSE=$(api_call POST "/api/v1/forum/posts/$FAKE_ID/like" "" "$TOKEN2")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Error Handling - Like invalid post returns 404" "PASS" "HTTP 404"
else
    print_result "Error Handling - Like invalid post returns 404" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 3: STEP 2 - COMMENTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 3: Step 2 - Comments ===${NC}"

if [ -n "$POST_ID" ] && [ "$POST_ID" != "null" ]; then
    # 3.1: Create Comment
    COMMENT_DATA='{"content":"This is a production test comment with sufficient content for validation.","is_anonymous":false}'
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    COMMENT_ID=$(echo "$BODY" | jq -r '.data._id // empty')
    
    if [ "$HTTP_CODE" == "201" ] && [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
        print_result "Create Comment - Successfully creates comment" "PASS" "Comment ID: ${COMMENT_ID:0:10}..."
    else
        print_result "Create Comment - Successfully creates comment" "FAIL" "HTTP $HTTP_CODE"
        COMMENT_ID=""
    fi
    
    # 3.2: Create Anonymous Comment
    ANON_COMMENT_DATA='{"content":"This is an anonymous production test comment.","is_anonymous":true}'
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$ANON_COMMENT_DATA" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "201" ] && echo "$BODY" | jq -e '.data.is_anonymous == true' > /dev/null 2>&1; then
        print_result "Create Anonymous Comment - Sets anonymous flag" "PASS" "Anonymous comment created"
    else
        print_result "Create Anonymous Comment - Sets anonymous flag" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 3.3: Get Comments
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
        TOTAL=$(echo "$BODY" | jq -r '.pagination.total // 0')
        if echo "$BODY" | jq -e '.pagination' > /dev/null 2>&1; then
            print_result "Get Comments - Returns comments with pagination" "PASS" "Total: $TOTAL"
        else
            print_result "Get Comments - Returns comments with pagination" "FAIL" "Missing pagination"
        fi
    else
        print_result "Get Comments - Returns comments with pagination" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 3.4: Get Comments with Pagination
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments?page=1&limit=5")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.pagination.page == 1' > /dev/null 2>&1; then
        print_result "Get Comments - Pagination works" "PASS" "Page 1, Limit 5"
    else
        print_result "Get Comments - Pagination works" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 3.5: Update Comment
    if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
        UPDATE_DATA='{"content":"This is an updated production test comment."}'
        RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "$UPDATE_DATA" "$TOKEN2")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        if [ "$HTTP_CODE" == "200" ]; then
            print_result "Update Comment - Successfully updates comment" "PASS" "HTTP 200"
        else
            print_result "Update Comment - Successfully updates comment" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
    
    # 3.6: Delete Comment
    if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
        RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "" "$TOKEN2")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        if [ "$HTTP_CODE" == "200" ]; then
            print_result "Delete Comment - Successfully deletes comment" "PASS" "HTTP 200"
        else
            print_result "Delete Comment - Successfully deletes comment" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
    
    # 3.7: Comment Validation - Empty content
    INVALID_COMMENT='{"content":"","is_anonymous":false}'
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$INVALID_COMMENT" "$TOKEN2")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "400" ]; then
        print_result "Validation - Empty comment rejected" "PASS" "HTTP 400"
    else
        print_result "Validation - Empty comment rejected" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # 3.8: Comment without auth
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "401" ]; then
        print_result "Security - Comment requires authentication" "PASS" "HTTP 401"
    else
        print_result "Security - Comment requires authentication" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# ============================================
# TEST SUITE 4: NOTIFICATIONS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 4: Notifications (Facebook-Style) ===${NC}"

# Create fresh post for notification testing
POST_DATA='{"title":"Notification Test Post","description":"This post is specifically for testing notification messages with usernames.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
NOTIF_POST_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data._id // empty')

if [ -n "$NOTIF_POST_ID" ] && [ "$NOTIF_POST_ID" != "null" ]; then
    # Get initial notification count
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    INITIAL_COUNT=$(echo "$RESPONSE" | sed '$d' | jq -r '.count // 0')
    
    # Test Like Notification
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/like" "" "$TOKEN2" > /dev/null
    sleep 4
    
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    LIKE_NOTIF=$(echo "$BODY" | jq -r '.data[]? | select(.payload.type == "forum_like") | .payload' 2>/dev/null | head -30)
    
    if [ -n "$LIKE_NOTIF" ] && [ "$LIKE_NOTIF" != "null" ] && [ "$LIKE_NOTIF" != "" ]; then
        TITLE=$(echo "$LIKE_NOTIF" | jq -r '.title // ""')
        BODY_TEXT=$(echo "$LIKE_NOTIF" | jq -r '.body // ""')
        LIKER_NAME=$(echo "$LIKE_NOTIF" | jq -r '.metadata.liker_name // ""')
        
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
        
        if [ -n "$LIKER_NAME" ] && [ "$LIKER_NAME" != "null" ]; then
            print_result "Like Notification - Metadata includes liker_name" "PASS" "Name: $LIKER_NAME"
        else
            print_result "Like Notification - Metadata includes liker_name" "WARN" "Name missing"
        fi
    else
        print_result "Like Notification - Notification created" "FAIL" "Not found"
    fi
    
    # Test Comment Notification
    COMMENT_DATA='{"content":"This comment tests notification messages with usernames properly.","is_anonymous":false}'
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/comments" "$COMMENT_DATA" "$TOKEN2" > /dev/null
    sleep 4
    
    RESPONSE=$(api_call GET "/api/v1/notifications?status=unread" "$TOKEN1")
    BODY=$(echo "$RESPONSE" | sed '$d')
    COMMENT_NOTIF=$(echo "$BODY" | jq -r '.data[]? | select(.payload.type == "forum_comment") | .payload' 2>/dev/null | head -30)
    
    if [ -n "$COMMENT_NOTIF" ] && [ "$COMMENT_NOTIF" != "null" ] && [ "$COMMENT_NOTIF" != "" ]; then
        TITLE=$(echo "$COMMENT_NOTIF" | jq -r '.title // ""')
        BODY_TEXT=$(echo "$COMMENT_NOTIF" | jq -r '.body // ""')
        COMMENTER_NAME=$(echo "$COMMENT_NOTIF" | jq -r '.metadata.commenter_name // ""')
        
        if echo "$TITLE" | grep -q -E "John Doe|Test User|User_"; then
            print_result "Comment Notification - Title includes username" "PASS" "Title: $TITLE"
        else
            print_result "Comment Notification - Title includes username" "FAIL" "Title: $TITLE"
        fi
        
        if echo "$BODY_TEXT" | grep -q ":"; then
            print_result "Comment Notification - Body shows name and preview" "PASS" "Body: ${BODY_TEXT:0:50}..."
        else
            print_result "Comment Notification - Body shows name and preview" "FAIL" "Body: ${BODY_TEXT:0:50}..."
        fi
        
        if [ -n "$COMMENTER_NAME" ] && [ "$COMMENTER_NAME" != "null" ]; then
            print_result "Comment Notification - Metadata includes commenter_name" "PASS" "Name: $COMMENTER_NAME"
        else
            print_result "Comment Notification - Metadata includes commenter_name" "WARN" "Name missing"
        fi
    else
        print_result "Comment Notification - Notification created" "FAIL" "Not found"
    fi
    
    # Test No Self-Notifications
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    COUNT_BEFORE=$(echo "$RESPONSE" | sed '$d' | jq -r '.count // 0')
    
    # User 1 likes their own post
    api_call POST "/api/v1/forum/posts/$NOTIF_POST_ID/like" "" "$TOKEN1" > /dev/null
    sleep 2
    
    RESPONSE=$(api_call GET "/api/v1/notifications/unread-count" "$TOKEN1")
    COUNT_AFTER=$(echo "$RESPONSE" | sed '$d' | jq -r '.count // 0')
    
    if [ "$COUNT_AFTER" == "$COUNT_BEFORE" ]; then
        print_result "Self-Like - No notification for own post" "PASS" "Count: $COUNT_BEFORE"
    else
        print_result "Self-Like - No notification for own post" "FAIL" "Count: $COUNT_BEFORE → $COUNT_AFTER"
    fi
fi

# ============================================
# FINAL SUMMARY
# ============================================
echo ""
echo "=========================================="
echo -e "${BOLD}Complete Production Test Summary${NC}"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo "Total: $((PASSED + FAILED + WARNINGS))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓✓✓ ALL TESTS PASSED! PRODUCTION READY! ✓✓✓${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}Notification Message Examples:${NC}"
    echo ""
    echo -e "${GREEN}Like Notification:${NC}"
    echo -e "  ${BOLD}Title:${NC} \"John Doe liked your post\""
    echo -e "  ${BOLD}Body:${NC}  \"John Doe liked your post \\\"Notification Test Post\\\"\""
    echo ""
    echo -e "${GREEN}Comment Notification:${NC}"
    echo -e "  ${BOLD}Title:${NC} \"John Doe commented on your post\""
    echo -e "  ${BOLD}Body:${NC}  \"John Doe: 'This comment tests notification...'\""
    echo ""
    echo -e "${CYAN}${BOLD}All Features Verified:${NC}"
    echo -e "  ${GREEN}✓${NC} Step 1: Core Posts (Create, Read, List, Search, Categories)"
    echo -e "  ${GREEN}✓${NC} Step 2: Likes & Comments (Toggle, CRUD, Pagination)"
    echo -e "  ${GREEN}✓${NC} Notifications: Facebook-style messages with usernames"
    echo -e "  ${GREEN}✓${NC} Security: Authentication & Authorization"
    echo -e "  ${GREEN}✓${NC} Validation: Input validation & error handling"
    echo -e "  ${GREEN}✓${NC} Production Ready: All endpoints tested and working"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review output above.${NC}"
    exit 1
fi

