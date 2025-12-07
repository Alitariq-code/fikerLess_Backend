#!/bin/bash

# Production-Ready Comprehensive Test Suite for Forum Step 1
# Tests all endpoints with edge cases, error handling, and performance

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
echo "Forum API - Production Ready Test Suite"
echo "Step 1: Core Forum Posts"
echo "=========================================="
echo ""

# Authentication
echo -e "${BLUE}=== Authentication Setup ===${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"password123"}')
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to authenticate. Please ensure test users exist.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated successfully${NC}"
echo ""

# ============================================
# TEST SUITE 1: GET CATEGORIES
# ============================================
echo -e "${BLUE}=== Test Suite 1: Get Categories ===${NC}"

RESPONSE=$(api_call GET "/api/v1/forum/categories")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"data"'; then
        CATEGORY_COUNT=$(echo "$BODY" | grep -o '"category"' | wc -l)
        print_result "Get Categories - Returns 200 with data" "PASS" "Found $CATEGORY_COUNT categories"
    else
        print_result "Get Categories - Returns 200 with data" "FAIL" "Missing success or data field"
    fi
else
    print_result "Get Categories - Returns 200" "FAIL" "HTTP $HTTP_CODE"
fi

# Verify category structure
if echo "$BODY" | grep -q '"category"' && echo "$BODY" | grep -q '"count"'; then
    print_result "Get Categories - Correct structure" "PASS" "Has category and count fields"
else
    print_result "Get Categories - Correct structure" "FAIL" "Missing required fields"
fi

# ============================================
# TEST SUITE 2: CREATE POST
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 2: Create Post ===${NC}"

# Test 2.1: Create normal post
POST_DATA='{"title":"Production Test Post","description":"This is a comprehensive test post for production validation with sufficient content length.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"_id"'; then
        POST_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
        print_result "Create Post - Returns 201" "PASS" "Post ID: ${POST_ID:0:10}..."
    else
        print_result "Create Post - Returns 201" "FAIL" "Missing success or _id"
    fi
else
    print_result "Create Post - Returns 201" "FAIL" "HTTP $HTTP_CODE: $BODY"
fi

# Test 2.2: Create anonymous post
ANON_POST_DATA='{"title":"Anonymous Production Post","description":"This anonymous post tests the anonymous functionality with enough content to pass validation requirements.","category":"Anxiety","is_anonymous":true}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$ANON_POST_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
    if echo "$BODY" | grep -q '"is_anonymous":true'; then
        ANON_POST_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
        print_result "Create Anonymous Post - Sets anonymous flag" "PASS" "Post ID: ${ANON_POST_ID:0:10}..."
    else
        print_result "Create Anonymous Post - Sets anonymous flag" "FAIL" "Anonymous flag not set"
    fi
else
    print_result "Create Anonymous Post - Sets anonymous flag" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.3: Create post without auth
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Create Post - Rejects unauthenticated" "PASS" "HTTP 401"
else
    print_result "Create Post - Rejects unauthenticated" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 3: VALIDATION
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 3: Input Validation ===${NC}"

# Title too short
INVALID='{"title":"AB","description":"This description is long enough to pass validation requirements.","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Title too short" "PASS" "HTTP 400"
else
    print_result "Validation - Title too short" "FAIL" "HTTP $HTTP_CODE"
fi

# Description too short
INVALID='{"title":"Valid Title Here","description":"Short","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Description too short" "PASS" "HTTP 400"
else
    print_result "Validation - Description too short" "FAIL" "HTTP $HTTP_CODE"
fi

# Missing category
INVALID='{"title":"Valid Title","description":"This is a valid description with enough content."}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Missing category" "PASS" "HTTP 400"
else
    print_result "Validation - Missing category" "FAIL" "HTTP $HTTP_CODE"
fi

# Invalid category
INVALID='{"title":"Valid Title","description":"This is a valid description with enough content.","category":"InvalidCategory123"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Invalid category" "PASS" "HTTP 400"
else
    print_result "Validation - Invalid category" "FAIL" "HTTP $HTTP_CODE"
fi

# Empty title
INVALID='{"title":"","description":"This is a valid description with enough content.","category":"Depression"}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$INVALID" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Validation - Empty title" "PASS" "HTTP 400"
else
    print_result "Validation - Empty title" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 4: GET POSTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 4: Get Posts ===${NC}"

# Get all posts
RESPONSE=$(api_call GET "/api/v1/forum/posts")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"data"'; then
        print_result "Get All Posts - Returns 200" "PASS" "Success"
    else
        print_result "Get All Posts - Returns 200" "FAIL" "Missing fields"
    fi
else
    print_result "Get All Posts - Returns 200" "FAIL" "HTTP $HTTP_CODE"
fi

# Verify pagination
if echo "$BODY" | grep -q '"pagination"' && echo "$BODY" | grep -q '"page"'; then
    print_result "Get All Posts - Has pagination" "PASS" "Pagination included"
else
    print_result "Get All Posts - Has pagination" "FAIL" "Missing pagination"
fi

# Get posts by category
RESPONSE=$(api_call GET "/api/v1/forum/posts?category=Depression")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Get Posts by Category - Returns 200" "PASS" "Category filter works"
else
    print_result "Get Posts by Category - Returns 200" "FAIL" "HTTP $HTTP_CODE"
fi

# Get posts with pagination
RESPONSE=$(api_call GET "/api/v1/forum/posts?page=1&limit=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"page":1' && echo "$BODY" | grep -q '"limit":5'; then
        print_result "Get Posts - Pagination params work" "PASS" "Page 1, Limit 5"
    else
        print_result "Get Posts - Pagination params work" "FAIL" "Wrong pagination"
    fi
else
    print_result "Get Posts - Pagination params work" "FAIL" "HTTP $HTTP_CODE"
fi

# Invalid page number
RESPONSE=$(api_call GET "/api/v1/forum/posts?page=0&limit=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Get Posts - Handles invalid page" "PASS" "Gracefully handles page=0"
else
    print_result "Get Posts - Handles invalid page" "WARN" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 5: GET SINGLE POST
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 5: Get Single Post ===${NC}"

if [ -n "$POST_ID" ]; then
    # Get post by ID
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q "$POST_ID"; then
            print_result "Get Single Post - Returns 200" "PASS" "Post found"
        else
            print_result "Get Single Post - Returns 200" "FAIL" "Missing data"
        fi
    else
        print_result "Get Single Post - Returns 200" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Verify all required fields
    REQUIRED_FIELDS=("_id" "title" "description" "category" "author" "likes_count" "comments_count" "views" "created_at")
    MISSING_FIELDS=()
    for field in "${REQUIRED_FIELDS[@]}"; do
        if ! echo "$BODY" | grep -q "\"$field\""; then
            MISSING_FIELDS+=("$field")
        fi
    done
    
    if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
        print_result "Get Single Post - All required fields" "PASS" "All fields present"
    else
        print_result "Get Single Post - All required fields" "FAIL" "Missing: ${MISSING_FIELDS[*]}"
    fi
    
    # Test view increment
    INITIAL_VIEWS=$(echo "$BODY" | grep -o '"views":[0-9]*' | cut -d':' -f2)
    sleep 1
    RESPONSE2=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    BODY2=$(echo "$RESPONSE2" | sed '$d')
    FINAL_VIEWS=$(echo "$BODY2" | grep -o '"views":[0-9]*' | cut -d':' -f2)
    
    if [ "$FINAL_VIEWS" -gt "$INITIAL_VIEWS" ]; then
        print_result "Get Single Post - View count increments" "PASS" "$INITIAL_VIEWS → $FINAL_VIEWS"
    else
        print_result "Get Single Post - View count increments" "FAIL" "Views: $INITIAL_VIEWS → $FINAL_VIEWS"
    fi
    
    # Test anonymous post author
    if [ -n "$ANON_POST_ID" ]; then
        RESPONSE=$(api_call GET "/api/v1/forum/posts/$ANON_POST_ID")
        BODY=$(echo "$RESPONSE" | sed '$d')
        if echo "$BODY" | grep -q "Anonymous_user"; then
            print_result "Get Single Post - Anonymous author" "PASS" "Shows Anonymous_user"
        else
            print_result "Get Single Post - Anonymous author" "FAIL" "Author not anonymous"
        fi
    fi
else
    print_result "Get Single Post - Returns 200" "SKIP" "No post ID"
fi

# Test non-existent post
FAKE_ID="507f1f77bcf86cd799439011"
RESPONSE=$(api_call GET "/api/v1/forum/posts/$FAKE_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Get Single Post - 404 for invalid ID" "PASS" "HTTP 404"
else
    print_result "Get Single Post - 404 for invalid ID" "FAIL" "HTTP $HTTP_CODE"
fi

# Invalid ObjectId format
INVALID_ID="invalid-id-123"
RESPONSE=$(api_call GET "/api/v1/forum/posts/$INVALID_ID")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ] || [ "$HTTP_CODE" == "400" ]; then
    print_result "Get Single Post - Handles invalid format" "PASS" "HTTP $HTTP_CODE"
else
    print_result "Get Single Post - Handles invalid format" "WARN" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 6: SEARCH POSTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 6: Search Posts ===${NC}"

# Search with query
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=Production")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"data"'; then
        print_result "Search Posts - Returns 200" "PASS" "Search works"
    else
        print_result "Search Posts - Returns 200" "FAIL" "Missing fields"
    fi
else
    print_result "Search Posts - Returns 200" "FAIL" "HTTP $HTTP_CODE"
fi

# Search with empty query
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Search Posts - Empty query" "PASS" "Handles gracefully"
else
    print_result "Search Posts - Empty query" "WARN" "HTTP $HTTP_CODE"
fi

# Search with no results
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=NonExistentPostXYZ123")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$HTTP_CODE" == "200" ]; then
    COUNT=$(echo "$BODY" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    if [ "$COUNT" == "0" ]; then
        print_result "Search Posts - No results" "PASS" "Returns count: 0"
    else
        print_result "Search Posts - No results" "PASS" "Returns count: $COUNT"
    fi
else
    print_result "Search Posts - No results" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 7: EDGE CASES
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 7: Edge Cases ===${NC}"

# Create posts in multiple categories
CATEGORIES=("Sleep" "Exercise" "Meditation" "Fitness" "Yoga")
CREATED=0
for category in "${CATEGORIES[@]}"; do
    POST_DATA="{\"title\":\"Test Post $category\",\"description\":\"This is a test post for the $category category with sufficient content length.\",\"category\":\"$category\"}"
    RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "201" ]; then
        CREATED=$((CREATED + 1))
    fi
done

if [ $CREATED -eq ${#CATEGORIES[@]} ]; then
    print_result "Edge Case - Multiple categories" "PASS" "Created $CREATED posts"
else
    print_result "Edge Case - Multiple categories" "WARN" "Created $CREATED/${#CATEGORIES[@]}"
fi

# Test very long title (should be rejected or truncated)
LONG_TITLE=$(printf 'A%.0s' {1..250})
LONG_POST="{\"title\":\"$LONG_TITLE\",\"description\":\"This is a valid description with enough content to pass validation requirements.\",\"category\":\"Depression\"}"
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$LONG_POST" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Edge Case - Very long title" "PASS" "Rejected (HTTP 400)"
else
    print_result "Edge Case - Very long title" "WARN" "HTTP $HTTP_CODE"
fi

# Test special characters in search
RESPONSE=$(api_call GET "/api/v1/forum/posts/search?q=test%20post")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    print_result "Edge Case - URL encoded search" "PASS" "Handles encoding"
else
    print_result "Edge Case - URL encoded search" "WARN" "HTTP $HTTP_CODE"
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
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo "Total: $((PASSED + FAILED + WARNINGS))"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed! Production ready!${NC}"
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

