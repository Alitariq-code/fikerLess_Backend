#!/bin/bash

# Test script for Forum endpoints with is_liked flag
# This script tests all forum endpoints to verify is_liked flag functionality

BASE_URL="${BASE_URL:-http://localhost:5002}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

echo "=========================================="
echo "Forum Endpoints Test - is_liked Flag"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -X "$method" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data" \
                "$BASE_URL$endpoint"
        else
            curl -s -X "$method" \
                -H "Authorization: Bearer $token" \
                "$BASE_URL$endpoint"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" \
                -H "Content-Type: application/json" \
                -d "$data" \
                "$BASE_URL$endpoint"
        else
            curl -s -X "$method" \
                "$BASE_URL$endpoint"
        fi
    fi
}

# Test helper functions
test_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    echo "  Response: $2"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠ WARN:${NC} $1"
    ((WARNINGS++))
}

# Step 1: Login to get token
echo "Step 1: Login to get authentication token..."
LOGIN_RESPONSE=$(api_call "POST" "/api/v1/auth/login" "" '{"email":"specialist@test.com","password":"password123"}')
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Failed to get authentication token${NC}"
    echo "Login response: $LOGIN_RESPONSE"
    echo ""
    echo "Please create a test user first or update the credentials in this script."
    exit 1
fi

test_pass "Login successful - Token obtained"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get existing posts (without auth) - should not have is_liked
echo "Step 2: Get All Posts (without authentication)..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts" "")
HAS_IS_LIKED=$(echo "$RESPONSE" | grep -o '"is_liked"')

if [ -z "$HAS_IS_LIKED" ]; then
    test_pass "Get Posts without auth - No is_liked field (correct)"
else
    test_fail "Get Posts without auth - Should not have is_liked field" "$RESPONSE"
fi
echo ""

# Step 3: Get posts with authentication - should have is_liked
echo "Step 3: Get All Posts (with authentication)..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts" "$TOKEN")
HAS_IS_LIKED=$(echo "$RESPONSE" | grep -o '"is_liked"')
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ] && [ -n "$HAS_IS_LIKED" ]; then
    test_pass "Get Posts with auth - is_liked field present"
    
    # Check if is_liked values are boolean
    IS_LIKED_VALUES=$(echo "$RESPONSE" | grep -o '"is_liked":[^,}]*' | cut -d':' -f2 | tr -d ' ')
    if echo "$IS_LIKED_VALUES" | grep -qE '^(true|false)$'; then
        test_pass "is_liked values are valid booleans"
    else
        test_warn "Some is_liked values may not be boolean: $IS_LIKED_VALUES"
    fi
else
    test_fail "Get Posts with auth - Missing is_liked field or success flag" "$RESPONSE"
fi
echo ""

# Step 4: Create a test post
echo "Step 4: Create a test post..."
POST_DATA='{"title":"Test Post for Like Flag","description":"This is a test post to verify the is_liked flag functionality.","category":"Anxiety","is_anonymous":false}'
CREATE_RESPONSE=$(api_call "POST" "/api/v1/forum/posts" "$TOKEN" "$POST_DATA")
POST_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$POST_ID" ]; then
    test_pass "Post created successfully - ID: $POST_ID"
else
    test_fail "Failed to create post" "$CREATE_RESPONSE"
    exit 1
fi
echo ""

# Step 5: Get the post - should have is_liked: false initially
echo "Step 5: Get Single Post (should have is_liked: false)..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts/$POST_ID" "$TOKEN")
HAS_IS_LIKED_FALSE=$(echo "$RESPONSE" | grep -o '"is_liked":false')

if [ -n "$HAS_IS_LIKED_FALSE" ]; then
    test_pass "Get Single Post - is_liked is false (not liked yet)"
else
    test_warn "Get Single Post - is_liked field may not be false or missing"
fi
echo ""

# Step 6: Like the post
echo "Step 6: Like the post..."
LIKE_RESPONSE=$(api_call "POST" "/api/v1/forum/posts/$POST_ID/like" "$TOKEN")
LIKE_SUCCESS=$(echo "$LIKE_RESPONSE" | grep -o '"success":true')
IS_LIKED_TRUE=$(echo "$LIKE_RESPONSE" | grep -o '"is_liked":true')

if [ -n "$LIKE_SUCCESS" ] && [ -n "$IS_LIKED_TRUE" ]; then
    test_pass "Like Post - Successfully liked, is_liked: true"
else
    test_fail "Like Post - Failed or incorrect response" "$LIKE_RESPONSE"
fi
echo ""

# Step 7: Get the post again - should have is_liked: true
echo "Step 7: Get Single Post again (should have is_liked: true)..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts/$POST_ID" "$TOKEN")
HAS_IS_LIKED_TRUE=$(echo "$RESPONSE" | grep -o '"is_liked":true')

if [ -n "$HAS_IS_LIKED_TRUE" ]; then
    test_pass "Get Single Post - is_liked is true (post is liked)"
else
    test_fail "Get Single Post - is_liked should be true but isn't" "$RESPONSE"
fi
echo ""

# Step 8: Get All Posts - should show is_liked: true for this post
echo "Step 8: Get All Posts - verify liked post shows is_liked: true..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts" "$TOKEN")
HAS_POST_WITH_LIKED=$(echo "$RESPONSE" | grep -A 5 "$POST_ID" | grep -o '"is_liked":true')

if [ -n "$HAS_POST_WITH_LIKED" ]; then
    test_pass "Get All Posts - Liked post shows is_liked: true"
else
    test_warn "Get All Posts - Could not verify is_liked: true for liked post"
fi
echo ""

# Step 9: Unlike the post
echo "Step 9: Unlike the post..."
UNLIKE_RESPONSE=$(api_call "POST" "/api/v1/forum/posts/$POST_ID/like" "$TOKEN")
UNLIKE_SUCCESS=$(echo "$UNLIKE_RESPONSE" | grep -o '"success":true')
IS_LIKED_FALSE=$(echo "$UNLIKE_RESPONSE" | grep -o '"is_liked":false')

if [ -n "$UNLIKE_SUCCESS" ] && [ -n "$IS_LIKED_FALSE" ]; then
    test_pass "Unlike Post - Successfully unliked, is_liked: false"
else
    test_fail "Unlike Post - Failed or incorrect response" "$UNLIKE_RESPONSE"
fi
echo ""

# Step 10: Get the post again - should have is_liked: false
echo "Step 10: Get Single Post again (should have is_liked: false)..."
RESPONSE=$(api_call "GET" "/api/v1/forum/posts/$POST_ID" "$TOKEN")
HAS_IS_LIKED_FALSE=$(echo "$RESPONSE" | grep -o '"is_liked":false')

if [ -n "$HAS_IS_LIKED_FALSE" ]; then
    test_pass "Get Single Post - is_liked is false (post is unliked)"
else
    test_fail "Get Single Post - is_liked should be false but isn't" "$RESPONSE"
fi
echo ""

# Step 11: Test Search Posts with authentication
echo "Step 11: Search Posts (with authentication)..."
SEARCH_RESPONSE=$(api_call "GET" "/api/v1/forum/posts/search?q=test" "$TOKEN")
SEARCH_SUCCESS=$(echo "$SEARCH_RESPONSE" | grep -o '"success":true')
SEARCH_HAS_IS_LIKED=$(echo "$SEARCH_RESPONSE" | grep -o '"is_liked"')

if [ -n "$SEARCH_SUCCESS" ] && [ -n "$SEARCH_HAS_IS_LIKED" ]; then
    test_pass "Search Posts with auth - is_liked field present"
else
    test_warn "Search Posts - is_liked field may be missing"
fi
echo ""

# Step 12: Test Get My Posts
echo "Step 12: Get My Posts..."
MY_POSTS_RESPONSE=$(api_call "GET" "/api/v1/forum/posts/my-posts" "$TOKEN")
MY_POSTS_SUCCESS=$(echo "$MY_POSTS_RESPONSE" | grep -o '"success":true')
MY_POSTS_HAS_IS_LIKED=$(echo "$MY_POSTS_RESPONSE" | grep -o '"is_liked"')

if [ -n "$MY_POSTS_SUCCESS" ] && [ -n "$MY_POSTS_HAS_IS_LIKED" ]; then
    test_pass "Get My Posts - is_liked field present"
else
    test_warn "Get My Posts - is_liked field may be missing"
fi
echo ""

# Step 13: Clean up - Delete the test post
echo "Step 13: Clean up - Delete test post..."
DELETE_RESPONSE=$(api_call "DELETE" "/api/v1/forum/posts/$POST_ID" "$TOKEN")
DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | grep -o '"success":true')

if [ -n "$DELETE_SUCCESS" ]; then
    test_pass "Delete Post - Test post deleted successfully"
else
    test_warn "Delete Post - May have failed: $DELETE_RESPONSE"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

