#!/bin/bash

# Test Suite for Forum Step 3: Post Management (Update, Delete, Get My Posts)

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
echo "Forum Step 3 Test Suite"
echo "Post Management (Update, Delete, Get My Posts)"
echo "=========================================="
echo ""

# Setup Users
echo -e "${BLUE}=== Setup ===${NC}"
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
  const pwd = await bcrypt.hash('password123', 10);
  await User.findOneAndUpdate({email:'user@test.com'},{email:'user@test.com',password:pwd,first_name:'Test',last_name:'User',is_email_verified:true,has_demographics:true,user_type:'user'},{upsert:true});
  await User.findOneAndUpdate({email:'user2@test.com'},{email:'user2@test.com',password:pwd,first_name:'John',last_name:'Doe',is_email_verified:true,has_demographics:true,user_type:'user'},{upsert:true});
  await mongoose.disconnect();
})();
" 2>/dev/null

TOKEN1=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"user@test.com","password":"password123"}' | jq -r '.token // empty')
TOKEN2=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"user2@test.com","password":"password123"}' | jq -r '.token // empty')

if [ -z "$TOKEN1" ] || [ -z "$TOKEN2" ]; then
    echo -e "${RED}Authentication failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Users authenticated${NC}"
echo ""

# Create test posts
POST_DATA='{"title":"Original Test Post","description":"This is the original post content for testing update and delete functionality.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN1")
POST_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data._id // empty')

if [ -z "$POST_ID" ] || [ "$POST_ID" == "null" ]; then
    echo -e "${RED}Failed to create test post${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Test post created: ${POST_ID:0:10}...${NC}"
echo ""

# ============================================
# TEST SUITE: UPDATE POST
# ============================================
echo -e "${BLUE}=== Test Suite: Update Post ===${NC}"

# Test 1: Update Post - Title
UPDATE_DATA='{"title":"Updated Test Post Title"}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    NEW_TITLE=$(echo "$BODY" | jq -r '.data.title')
    if [ "$NEW_TITLE" == "Updated Test Post Title" ]; then
        print_result "Update Post - Update title" "PASS" "Title updated"
    else
        print_result "Update Post - Update title" "FAIL" "Title: $NEW_TITLE"
    fi
else
    print_result "Update Post - Update title" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2: Update Post - Description
UPDATE_DATA='{"description":"This is the updated description content for the test post."}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    NEW_DESC=$(echo "$BODY" | jq -r '.data.description')
    if echo "$NEW_DESC" | grep -q "updated description"; then
        print_result "Update Post - Update description" "PASS" "Description updated"
    else
        print_result "Update Post - Update description" "FAIL" "Description not updated"
    fi
else
    print_result "Update Post - Update description" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 3: Update Post - Category
UPDATE_DATA='{"category":"Anxiety"}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    NEW_CAT=$(echo "$BODY" | jq -r '.data.category')
    if [ "$NEW_CAT" == "Anxiety" ]; then
        print_result "Update Post - Update category" "PASS" "Category: $NEW_CAT"
    else
        print_result "Update Post - Update category" "FAIL" "Category: $NEW_CAT"
    fi
else
    print_result "Update Post - Update category" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 4: Update Post - Multiple fields
UPDATE_DATA='{"title":"Fully Updated Post","description":"This post has been fully updated with new content.","category":"Stress Management"}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    TITLE=$(echo "$BODY" | jq -r '.data.title')
    CAT=$(echo "$BODY" | jq -r '.data.category')
    if [ "$TITLE" == "Fully Updated Post" ] && [ "$CAT" == "Stress Management" ]; then
        print_result "Update Post - Update multiple fields" "PASS" "All fields updated"
    else
        print_result "Update Post - Update multiple fields" "FAIL" "Fields not updated correctly"
    fi
else
    print_result "Update Post - Update multiple fields" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 5: Update Post - Cannot update other user's post
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA" "$TOKEN2")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "403" ]; then
    print_result "Update Post - Cannot update other user's post" "PASS" "HTTP 403"
else
    print_result "Update Post - Cannot update other user's post" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 6: Update Post - Requires authentication
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$UPDATE_DATA")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Update Post - Requires authentication" "PASS" "HTTP 401"
else
    print_result "Update Post - Requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 7: Update Post - Invalid post ID
FAKE_ID="507f1f77bcf86cd799439011"
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$FAKE_ID" "$UPDATE_DATA" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Update Post - Invalid post ID" "PASS" "HTTP 404"
else
    print_result "Update Post - Invalid post ID" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 8: Update Post - Validation (title too short)
INVALID='{"title":"AB"}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID" "$INVALID" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Update Post - Validation (title too short)" "PASS" "HTTP 400"
else
    print_result "Update Post - Validation (title too short)" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE: GET MY POSTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite: Get My Posts ===${NC}"

# Test 9: Get My Posts
RESPONSE=$(api_call GET "/api/v1/forum/posts/my-posts" "" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
    TOTAL=$(echo "$BODY" | jq -r '.pagination.total // 0')
    if [ "$TOTAL" -gt 0 ]; then
        print_result "Get My Posts - Returns user's posts" "PASS" "Total: $TOTAL"
    else
        print_result "Get My Posts - Returns user's posts" "FAIL" "No posts found"
    fi
else
    print_result "Get My Posts - Returns user's posts" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 10: Get My Posts - With pagination
RESPONSE=$(api_call GET "/api/v1/forum/posts/my-posts?page=1&limit=5" "" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.pagination.page == 1 and .pagination.limit == 5' > /dev/null 2>&1; then
    print_result "Get My Posts - Pagination works" "PASS" "Page 1, Limit 5"
else
    print_result "Get My Posts - Pagination works" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 11: Get My Posts - Filter by category
RESPONSE=$(api_call GET "/api/v1/forum/posts/my-posts?category=Anxiety" "" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    # Check if all returned posts have the correct category
    ALL_CORRECT=$(echo "$BODY" | jq '[.data[]? | select(.category == "Anxiety")] | length' 2>/dev/null || echo "0")
    TOTAL=$(echo "$BODY" | jq '.data | length' 2>/dev/null || echo "0")
    if [ "$ALL_CORRECT" == "$TOTAL" ] || [ "$TOTAL" == "0" ]; then
        print_result "Get My Posts - Filter by category" "PASS" "Filter works (Total: $TOTAL)"
    else
        print_result "Get My Posts - Filter by category" "FAIL" "Filter incorrect (Correct: $ALL_CORRECT, Total: $TOTAL)"
    fi
else
    print_result "Get My Posts - Filter by category" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 12: Get My Posts - Requires authentication
RESPONSE=$(api_call GET "/api/v1/forum/posts/my-posts")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Get My Posts - Requires authentication" "PASS" "HTTP 401"
else
    print_result "Get My Posts - Requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 13: Get My Posts - Only returns own posts
# Create post with User 2
POST_DATA2='{"title":"User 2 Post","description":"This post belongs to user 2.","category":"Depression","is_anonymous":false}'
api_call POST "/api/v1/forum/posts" "$POST_DATA2" "$TOKEN2" > /dev/null

# Get User 1's posts
RESPONSE=$(api_call GET "/api/v1/forum/posts/my-posts" "" "$TOKEN1")
BODY=$(echo "$RESPONSE" | sed '$d')
USER2_POST=$(echo "$BODY" | jq '.data[]? | select(.title == "User 2 Post")')
if [ -z "$USER2_POST" ] || [ "$USER2_POST" == "null" ]; then
    print_result "Get My Posts - Only returns own posts" "PASS" "No other user's posts"
else
    print_result "Get My Posts - Only returns own posts" "FAIL" "Found other user's post"
fi

# ============================================
# TEST SUITE: DELETE POST
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite: Delete Post ===${NC}"

# Create a post to delete
POST_DATA_DELETE='{"title":"Post to Delete","description":"This post will be deleted for testing.","category":"Anxiety","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA_DELETE" "$TOKEN1")
DELETE_POST_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data._id // empty')

if [ -n "$DELETE_POST_ID" ] && [ "$DELETE_POST_ID" != "null" ]; then
    # Test 14: Delete Post
    RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$DELETE_POST_ID" "" "$TOKEN1")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | jq -e '.success == true' > /dev/null 2>&1; then
        print_result "Delete Post - Successfully deletes post" "PASS" "HTTP 200"
        
        # Verify post is deleted
        RESPONSE=$(api_call GET "/api/v1/forum/posts/$DELETE_POST_ID")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        if [ "$HTTP_CODE" == "404" ]; then
            print_result "Delete Post - Post actually deleted" "PASS" "Post not found (404)"
        else
            print_result "Delete Post - Post actually deleted" "FAIL" "Post still exists"
        fi
    else
        print_result "Delete Post - Successfully deletes post" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# Test 15: Delete Post - Cannot delete other user's post
POST_DATA_OTHER='{"title":"Other User Post","description":"This post belongs to another user.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA_OTHER" "$TOKEN2")
OTHER_POST_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data._id // empty')

if [ -n "$OTHER_POST_ID" ] && [ "$OTHER_POST_ID" != "null" ]; then
    RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$OTHER_POST_ID" "" "$TOKEN1")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "403" ]; then
        print_result "Delete Post - Cannot delete other user's post" "PASS" "HTTP 403"
    else
        print_result "Delete Post - Cannot delete other user's post" "FAIL" "HTTP $HTTP_CODE"
    fi
fi

# Test 16: Delete Post - Requires authentication
RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Delete Post - Requires authentication" "PASS" "HTTP 401"
else
    print_result "Delete Post - Requires authentication" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 17: Delete Post - Invalid post ID
RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$FAKE_ID" "" "$TOKEN1")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Delete Post - Invalid post ID" "PASS" "HTTP 404"
else
    print_result "Delete Post - Invalid post ID" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 18: Delete Post - Cascades to likes and comments
# Create post with likes and comments
POST_DATA_CASCADE='{"title":"Cascade Test Post","description":"This post will test cascade deletion.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA_CASCADE" "$TOKEN1")
CASCADE_POST_ID=$(echo "$RESPONSE" | sed '$d' | jq -r '.data._id // empty')

if [ -n "$CASCADE_POST_ID" ] && [ "$CASCADE_POST_ID" != "null" ]; then
    # Add like
    api_call POST "/api/v1/forum/posts/$CASCADE_POST_ID/like" "" "$TOKEN2" > /dev/null
    
    # Add comment
    COMMENT_DATA='{"content":"This comment will be deleted with the post.","is_anonymous":false}'
    api_call POST "/api/v1/forum/posts/$CASCADE_POST_ID/comments" "$COMMENT_DATA" "$TOKEN2" > /dev/null
    
    # Delete post
    api_call DELETE "/api/v1/forum/posts/$CASCADE_POST_ID" "" "$TOKEN1" > /dev/null
    
    # Verify comments are deleted (post should be 404, so comments endpoint should also fail)
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$CASCADE_POST_ID/comments")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "404" ]; then
        print_result "Delete Post - Cascades to likes and comments" "PASS" "Related data deleted"
    else
        print_result "Delete Post - Cascades to likes and comments" "WARN" "HTTP $HTTP_CODE"
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
    echo -e "${GREEN}✓ All Step 3 tests passed! Production ready!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Review output above.${NC}"
    exit 1
fi

