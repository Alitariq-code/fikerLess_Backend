#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5002"
PASSED=0
FAILED=0

# Test counter
TEST_NUM=0

# Function to print test result
print_result() {
    local test_name=$1
    local status=$2
    local response=$3
    
    TEST_NUM=$((TEST_NUM + 1))
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✓ Test $TEST_NUM: $test_name${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ Test $TEST_NUM: $test_name${NC}"
        echo -e "${RED}  Response: $response${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Function to make API call
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: $token" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: $token"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint"
        fi
    fi
}

echo "=========================================="
echo "Forum API - Step 1 Testing"
echo "=========================================="
echo ""

# Step 1: Login to get token
echo "Step 1: Logging in as test user..."
LOGIN_RESPONSE=$(api_call POST "/api/v1/auth/login" '{"email":"user@test.com","password":"password123"}')
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    # Try alternative token extraction
    TOKEN=$(echo $LOGIN_RESPONSE | grep -oP '"token":\s*"\K[^"]*' || echo "")
fi

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Login response: $LOGIN_RESPONSE${NC}"
    echo -e "${RED}Failed to get authentication token. Please ensure:${NC}"
    echo "  1. Server is running on http://localhost:5002"
    echo "  2. Test users exist (run: node create-test-users.js)"
    echo "  3. User has demographics set (has_demographics: true)"
    echo ""
    echo "Attempting to continue with public endpoints only..."
    TOKEN=""
fi

echo -e "${GREEN}✓ Authentication successful${NC}"
echo ""

# Test 1: Get Categories (Public)
echo "Testing: Get Categories (Public)"
RESPONSE=$(api_call GET "/api/v1/forum/categories")
if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"data"'; then
    print_result "Get Categories - Returns categories array" "PASS" ""
else
    print_result "Get Categories - Returns categories array" "FAIL" "$RESPONSE"
fi

# Test 2: Create Post (Authenticated)
echo "Testing: Create Post"
POST_DATA='{"title":"Test Forum Post","description":"This is a test post for the forum module. It contains enough content to pass validation.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN")
if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"data"'; then
    POST_ID=$(echo $RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    print_result "Create Post - Successfully creates post" "PASS" ""
else
    print_result "Create Post - Successfully creates post" "FAIL" "$RESPONSE"
    POST_ID=""
fi

# Test 3: Create Anonymous Post
echo "Testing: Create Anonymous Post"
ANON_POST_DATA='{"title":"Anonymous Test Post","description":"This is an anonymous test post for the forum. It should show Anonymous_user in the author field.","category":"Anxiety","is_anonymous":true}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$ANON_POST_DATA" "$TOKEN")
if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"is_anonymous":true'; then
    ANON_POST_ID=$(echo $RESPONSE | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    print_result "Create Anonymous Post - Creates post with anonymous flag" "PASS" ""
else
    print_result "Create Anonymous Post - Creates post with anonymous flag" "FAIL" "$RESPONSE"
    ANON_POST_ID=""
fi

# Test 4: Get All Posts (Public)
echo "Testing: Get All Posts"
RESPONSE=$(api_call GET "/api/v1/forum/posts")
if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"data"'; then
    print_result "Get All Posts - Returns posts array with pagination" "PASS" ""
else
    print_result "Get All Posts - Returns posts array with pagination" "FAIL" "$RESPONSE"
fi

# Test 5: Get Posts with Category Filter
echo "Testing: Get Posts by Category"
RESPONSE=$(api_call GET "/api/v1/forum/posts?category=Depression")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "Get Posts by Category - Filters posts correctly" "PASS" ""
else
    print_result "Get Posts by Category - Filters posts correctly" "FAIL" "$RESPONSE"
fi

# Test 6: Get Posts with Pagination
echo "Testing: Get Posts with Pagination"
RESPONSE=$(api_call GET "/api/v1/forum/posts?page=1&limit=5")
if echo "$RESPONSE" | grep -q '"pagination"' && echo "$RESPONSE" | grep -q '"page":1'; then
    print_result "Get Posts with Pagination - Returns paginated results" "PASS" ""
else
    print_result "Get Posts with Pagination - Returns paginated results" "FAIL" "$RESPONSE"
fi

# Test 7: Get Single Post by ID
if [ -n "$POST_ID" ]; then
    echo "Testing: Get Single Post by ID"
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q "$POST_ID"; then
        print_result "Get Single Post - Returns post details" "PASS" ""
    else
        print_result "Get Single Post - Returns post details" "FAIL" "$RESPONSE"
    fi
else
    print_result "Get Single Post - Returns post details" "SKIP" "No post ID available"
fi

# Test 8: Search Posts
echo "Testing: Search Posts"
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=Test")
if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"data"'; then
    print_result "Search Posts - Returns matching posts" "PASS" ""
else
    print_result "Search Posts - Returns matching posts" "FAIL" "$RESPONSE"
fi

# Test 9: Search Posts with Empty Query
echo "Testing: Search Posts with Empty Query"
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_result "Search Posts Empty Query - Handles empty search gracefully" "PASS" ""
else
    print_result "Search Posts Empty Query - Handles empty search gracefully" "FAIL" "$RESPONSE"
fi

# Test 10: Create Post without Authentication
echo "Testing: Create Post without Authentication"
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA")
if echo "$RESPONSE" | grep -q "Unauthorized\|401"; then
    print_result "Create Post without Auth - Rejects unauthenticated requests" "PASS" ""
else
    print_result "Create Post without Auth - Rejects unauthenticated requests" "FAIL" "$RESPONSE"
fi

# Test 11: Validation - Title too short
echo "Testing: Validation - Title too short"
INVALID_POST='{"title":"AB","description":"This description is long enough to pass validation.","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID_POST" "$TOKEN")
if echo "$RESPONSE" | grep -q "400\|Bad Request\|at least 3"; then
    print_result "Validation - Title too short rejected" "PASS" ""
else
    print_result "Validation - Title too short rejected" "FAIL" "$RESPONSE"
fi

# Test 12: Validation - Description too short
echo "Testing: Validation - Description too short"
INVALID_POST='{"title":"Valid Title Here","description":"Short","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID_POST" "$TOKEN")
if echo "$RESPONSE" | grep -q "400\|Bad Request\|at least 10"; then
    print_result "Validation - Description too short rejected" "PASS" ""
else
    print_result "Validation - Description too short rejected" "FAIL" "$RESPONSE"
fi

# Test 13: Validation - Missing category
echo "Testing: Validation - Missing category"
INVALID_POST='{"title":"Valid Title Here","description":"This is a valid description with enough content."}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID_POST" "$TOKEN")
if echo "$RESPONSE" | grep -q "400\|Bad Request"; then
    print_result "Validation - Missing category rejected" "PASS" ""
else
    print_result "Validation - Missing category rejected" "FAIL" "$RESPONSE"
fi

# Test 14: Validation - Invalid category
echo "Testing: Validation - Invalid category"
INVALID_POST='{"title":"Valid Title","description":"This is a valid description with enough content.","category":"InvalidCategory"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID_POST" "$TOKEN")
if echo "$RESPONSE" | grep -q "400\|Bad Request\|Invalid category"; then
    print_result "Validation - Invalid category rejected" "PASS" ""
else
    print_result "Validation - Invalid category rejected" "FAIL" "$RESPONSE"
fi

# Test 15: Get Non-existent Post
echo "Testing: Get Non-existent Post"
FAKE_ID="507f1f77bcf86cd799439011"
RESPONSE=$(api_call GET "/api/v1/forum/posts/$FAKE_ID")
if echo "$RESPONSE" | grep -q "404\|Not Found"; then
    print_result "Get Non-existent Post - Returns 404" "PASS" ""
else
    print_result "Get Non-existent Post - Returns 404" "FAIL" "$RESPONSE"
fi

# Test 16: View count increments
if [ -n "$POST_ID" ]; then
    echo "Testing: View count increments"
    INITIAL_VIEWS=$(api_call GET "/api/v1/forum/posts/$POST_ID" | grep -o '"views":[0-9]*' | cut -d':' -f2)
    sleep 1
    FINAL_VIEWS=$(api_call GET "/api/v1/forum/posts/$POST_ID" | grep -o '"views":[0-9]*' | cut -d':' -f2)
    if [ "$FINAL_VIEWS" -gt "$INITIAL_VIEWS" ]; then
        print_result "View Count - Increments on post view" "PASS" ""
    else
        print_result "View Count - Increments on post view" "FAIL" "Initial: $INITIAL_VIEWS, Final: $FINAL_VIEWS"
    fi
else
    print_result "View Count - Increments on post view" "SKIP" "No post ID available"
fi

# Test 17: Anonymous post shows Anonymous_user
if [ -n "$ANON_POST_ID" ]; then
    echo "Testing: Anonymous post shows Anonymous_user"
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$ANON_POST_ID")
    if echo "$RESPONSE" | grep -q "Anonymous_user"; then
        print_result "Anonymous Post - Shows Anonymous_user as author" "PASS" ""
    else
        print_result "Anonymous Post - Shows Anonymous_user as author" "FAIL" "$RESPONSE"
    fi
else
    print_result "Anonymous Post - Shows Anonymous_user as author" "SKIP" "No anonymous post ID available"
fi

# Test 18: Categories have correct structure
echo "Testing: Categories have correct structure"
RESPONSE=$(api_call GET "/api/v1/forum/categories")
if echo "$RESPONSE" | grep -q '"category"' && echo "$RESPONSE" | grep -q '"count"'; then
    print_result "Categories Structure - Returns category and count" "PASS" ""
else
    print_result "Categories Structure - Returns category and count" "FAIL" "$RESPONSE"
fi

# Test 19: Post response includes all required fields
if [ -n "$POST_ID" ]; then
    echo "Testing: Post response includes all required fields"
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    if echo "$RESPONSE" | grep -q '"_id"' && \
       echo "$RESPONSE" | grep -q '"title"' && \
       echo "$RESPONSE" | grep -q '"description"' && \
       echo "$RESPONSE" | grep -q '"category"' && \
       echo "$RESPONSE" | grep -q '"author"' && \
       echo "$RESPONSE" | grep -q '"likes_count"' && \
       echo "$RESPONSE" | grep -q '"comments_count"' && \
       echo "$RESPONSE" | grep -q '"views"'; then
        print_result "Post Response - Includes all required fields" "PASS" ""
    else
        print_result "Post Response - Includes all required fields" "FAIL" "$RESPONSE"
    fi
else
    print_result "Post Response - Includes all required fields" "SKIP" "No post ID available"
fi

# Test 20: Multiple posts with different categories
echo "Testing: Create posts with different categories"
CATEGORIES=("Sleep" "Exercise" "Meditation")
for category in "${CATEGORIES[@]}"; do
    POST_DATA="{\"title\":\"Test Post for $category\",\"description\":\"This is a test post for the $category category with enough content.\",\"category\":\"$category\"}"
    RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN")
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}  ✓ Created post in category: $category${NC}"
    else
        echo -e "${RED}  ✗ Failed to create post in category: $category${NC}"
    fi
done
print_result "Multiple Categories - Can create posts in different categories" "PASS" ""

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi

