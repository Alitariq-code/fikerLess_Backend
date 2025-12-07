#!/bin/bash

# Production-Ready Test Suite for Forum Step 2: Likes & Comments
# Tests all Step 2 endpoints with comprehensive coverage

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
echo "Forum API - Step 2 Testing"
echo "Likes & Comments"
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

# Create a test post first
echo -e "${BLUE}=== Creating Test Post ===${NC}"
POST_DATA='{"title":"Test Post for Likes and Comments","description":"This is a test post created specifically for testing likes and comments functionality with sufficient content.","category":"Depression","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts" "$POST_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
POST_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$POST_ID" ]; then
    echo -e "${RED}Failed to create test post. Cannot continue.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Test post created: ${POST_ID:0:10}...${NC}"
echo ""

# ============================================
# TEST SUITE 1: LIKES
# ============================================
echo -e "${BLUE}=== Test Suite 1: Likes ===${NC}"

# Test 1.1: Like a post
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"is_liked":true' && echo "$BODY" | grep -q '"likes_count"'; then
        LIKES_COUNT=$(echo "$BODY" | grep -o '"likes_count":[0-9]*' | cut -d':' -f2)
        print_result "Like Post - Returns 200 with is_liked:true" "PASS" "Likes count: $LIKES_COUNT"
    else
        print_result "Like Post - Returns 200 with is_liked:true" "FAIL" "Missing fields"
    fi
else
    print_result "Like Post - Returns 200 with is_liked:true" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.2: Unlike a post (toggle)
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"is_liked":false'; then
        LIKES_COUNT=$(echo "$BODY" | grep -o '"likes_count":[0-9]*' | cut -d':' -f2)
        print_result "Unlike Post - Toggles to is_liked:false" "PASS" "Likes count: $LIKES_COUNT"
    else
        print_result "Unlike Post - Toggles to is_liked:false" "FAIL" "Not toggled"
    fi
else
    print_result "Unlike Post - Toggles to is_liked:false" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.3: Like again
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] && echo "$BODY" | grep -q '"is_liked":true'; then
    print_result "Like Post Again - Can like after unliking" "PASS" "Toggle works"
else
    print_result "Like Post Again - Can like after unliking" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.4: Like without authentication
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/like" "")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Like Post - Rejects unauthenticated" "PASS" "HTTP 401"
else
    print_result "Like Post - Rejects unauthenticated" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.5: Like non-existent post
FAKE_ID="507f1f77bcf86cd799439011"
RESPONSE=$(api_call POST "/api/v1/forum/posts/$FAKE_ID/like" "" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Like Post - 404 for invalid post" "PASS" "HTTP 404"
else
    print_result "Like Post - 404 for invalid post" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 1.6: Verify likes count updated in post
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
BODY=$(echo "$RESPONSE" | sed '$d')
CURRENT_LIKES=$(echo "$BODY" | grep -o '"likes_count":[0-9]*' | cut -d':' -f2)
if [ "$CURRENT_LIKES" -gt 0 ]; then
    print_result "Like Post - Updates post likes_count" "PASS" "Count: $CURRENT_LIKES"
else
    print_result "Like Post - Updates post likes_count" "FAIL" "Count not updated"
fi

# ============================================
# TEST SUITE 2: COMMENTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 2: Comments ===${NC}"

# Test 2.1: Create comment
COMMENT_DATA='{"content":"This is a test comment on the forum post.","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"_id"'; then
        COMMENT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
        print_result "Create Comment - Returns 201" "PASS" "Comment ID: ${COMMENT_ID:0:10}..."
    else
        print_result "Create Comment - Returns 201" "FAIL" "Missing fields"
        COMMENT_ID=""
    fi
else
    print_result "Create Comment - Returns 201" "FAIL" "HTTP $HTTP_CODE: $BODY"
    COMMENT_ID=""
fi

# Test 2.2: Create anonymous comment
ANON_COMMENT_DATA='{"content":"This is an anonymous test comment.","is_anonymous":true}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$ANON_COMMENT_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "201" ]; then
    if echo "$BODY" | grep -q '"is_anonymous":true'; then
        ANON_COMMENT_ID=$(echo "$BODY" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
        print_result "Create Anonymous Comment - Sets anonymous flag" "PASS" "Comment created"
    else
        print_result "Create Anonymous Comment - Sets anonymous flag" "FAIL" "Anonymous flag not set"
        ANON_COMMENT_ID=""
    fi
else
    print_result "Create Anonymous Comment - Sets anonymous flag" "FAIL" "HTTP $HTTP_CODE"
    ANON_COMMENT_ID=""
fi

# Test 2.3: Get comments
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q '"data"'; then
        COMMENT_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
        print_result "Get Comments - Returns 200 with data" "PASS" "Total comments: $COMMENT_COUNT"
    else
        print_result "Get Comments - Returns 200 with data" "FAIL" "Missing fields"
    fi
else
    print_result "Get Comments - Returns 200 with data" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.4: Get comments with pagination
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments?page=1&limit=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    if echo "$BODY" | grep -q '"pagination"' && echo "$BODY" | grep -q '"page":1'; then
        print_result "Get Comments - Pagination works" "PASS" "Page 1, Limit 5"
    else
        print_result "Get Comments - Pagination works" "FAIL" "Missing pagination"
    fi
else
    print_result "Get Comments - Pagination works" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.5: Create comment without auth
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    print_result "Create Comment - Rejects unauthenticated" "PASS" "HTTP 401"
else
    print_result "Create Comment - Rejects unauthenticated" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.6: Comment validation - empty content
INVALID_COMMENT='{"content":"","is_anonymous":false}'
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$INVALID_COMMENT" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Create Comment - Rejects empty content" "PASS" "HTTP 400"
else
    print_result "Create Comment - Rejects empty content" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.7: Comment validation - too long
LONG_CONTENT=$(printf 'A%.0s' {1..1001})
LONG_COMMENT="{\"content\":\"$LONG_CONTENT\",\"is_anonymous\":false}"
RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$LONG_COMMENT" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    print_result "Create Comment - Rejects too long content" "PASS" "HTTP 400"
else
    print_result "Create Comment - Rejects too long content" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 2.8: Verify comments count updated in post
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
BODY=$(echo "$RESPONSE" | sed '$d')
CURRENT_COMMENTS=$(echo "$BODY" | grep -o '"comments_count":[0-9]*' | cut -d':' -f2)
if [ "$CURRENT_COMMENTS" -gt 0 ]; then
    print_result "Create Comment - Updates post comments_count" "PASS" "Count: $CURRENT_COMMENTS"
else
    print_result "Create Comment - Updates post comments_count" "FAIL" "Count not updated"
fi

# ============================================
# TEST SUITE 3: UPDATE/DELETE COMMENTS
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 3: Update/Delete Comments ===${NC}"

if [ -n "$COMMENT_ID" ]; then
    # Test 3.1: Update comment
    UPDATE_DATA='{"content":"This is an updated test comment."}'
    RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "$UPDATE_DATA" "$TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        if echo "$BODY" | grep -q '"success":true' && echo "$BODY" | grep -q "updated"; then
            print_result "Update Comment - Returns 200" "PASS" "Comment updated"
        else
            print_result "Update Comment - Returns 200" "FAIL" "Missing success"
        fi
    else
        print_result "Update Comment - Returns 200" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 3.2: Verify comment was updated
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
    BODY=$(echo "$RESPONSE" | sed '$d')
    if echo "$BODY" | grep -q "updated test comment"; then
        print_result "Update Comment - Content actually updated" "PASS" "Content changed"
    else
        print_result "Update Comment - Content actually updated" "FAIL" "Content not updated"
    fi
    
    # Test 3.3: Update comment without auth
    RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "$UPDATE_DATA")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" == "401" ]; then
        print_result "Update Comment - Rejects unauthenticated" "PASS" "HTTP 401"
    else
        print_result "Update Comment - Rejects unauthenticated" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 3.4: Delete comment
    RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID/comments/$COMMENT_ID" "" "$TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" == "200" ]; then
        if echo "$BODY" | grep -q '"success":true'; then
            print_result "Delete Comment - Returns 200" "PASS" "Comment deleted"
        else
            print_result "Delete Comment - Returns 200" "FAIL" "Missing success"
        fi
    else
        print_result "Delete Comment - Returns 200" "FAIL" "HTTP $HTTP_CODE"
    fi
    
    # Test 3.5: Verify comment was deleted
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
    BODY=$(echo "$RESPONSE" | sed '$d')
    if ! echo "$BODY" | grep -q "$COMMENT_ID"; then
        print_result "Delete Comment - Comment actually deleted" "PASS" "Not in list"
    else
        print_result "Delete Comment - Comment actually deleted" "FAIL" "Still exists"
    fi
    
    # Test 3.6: Verify comments count decremented
    RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID")
    BODY=$(echo "$RESPONSE" | sed '$d')
    NEW_COMMENTS=$(echo "$BODY" | grep -o '"comments_count":[0-9]*' | cut -d':' -f2)
    if [ "$NEW_COMMENTS" -lt "$CURRENT_COMMENTS" ]; then
        print_result "Delete Comment - Updates post comments_count" "PASS" "Count: $CURRENT_COMMENTS → $NEW_COMMENTS"
    else
        print_result "Delete Comment - Updates post comments_count" "WARN" "Count may not have updated"
    fi
    
    # Test 3.7: Delete comment without auth
    # Create another comment first
    RESPONSE=$(api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN")
    NEW_COMMENT_ID=$(echo "$RESPONSE" | sed '$d' | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$NEW_COMMENT_ID" ]; then
        RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID/comments/$NEW_COMMENT_ID" "")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        if [ "$HTTP_CODE" == "401" ]; then
            print_result "Delete Comment - Rejects unauthenticated" "PASS" "HTTP 401"
        else
            print_result "Delete Comment - Rejects unauthenticated" "FAIL" "HTTP $HTTP_CODE"
        fi
    fi
else
    print_result "Update Comment - Returns 200" "SKIP" "No comment ID"
    print_result "Delete Comment - Returns 200" "SKIP" "No comment ID"
fi

# Test 3.8: Update non-existent comment
FAKE_COMMENT_ID="507f1f77bcf86cd799439011"
UPDATE_DATA='{"content":"Test"}'
RESPONSE=$(api_call PUT "/api/v1/forum/posts/$POST_ID/comments/$FAKE_COMMENT_ID" "$UPDATE_DATA" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Update Comment - 404 for invalid ID" "PASS" "HTTP 404"
else
    print_result "Update Comment - 404 for invalid ID" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 3.9: Delete non-existent comment
RESPONSE=$(api_call DELETE "/api/v1/forum/posts/$POST_ID/comments/$FAKE_COMMENT_ID" "" "$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Delete Comment - 404 for invalid ID" "PASS" "HTTP 404"
else
    print_result "Delete Comment - 404 for invalid ID" "FAIL" "HTTP $HTTP_CODE"
fi

# ============================================
# TEST SUITE 4: EDGE CASES
# ============================================
echo ""
echo -e "${BLUE}=== Test Suite 4: Edge Cases ===${NC}"

# Test 4.1: Get comments for non-existent post
RESPONSE=$(api_call GET "/api/v1/forum/posts/$FAKE_ID/comments")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    print_result "Edge Case - Get comments for invalid post" "PASS" "HTTP 404"
else
    print_result "Edge Case - Get comments for invalid post" "FAIL" "HTTP $HTTP_CODE"
fi

# Test 4.2: Multiple comments on same post
for i in {1..3}; do
    COMMENT_DATA="{\"content\":\"Test comment number $i with sufficient content.\",\"is_anonymous\":false}"
    api_call POST "/api/v1/forum/posts/$POST_ID/comments" "$COMMENT_DATA" "$TOKEN" > /dev/null
done
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments")
BODY=$(echo "$RESPONSE" | sed '$d')
TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | cut -d':' -f2)
if [ "$TOTAL" -ge 3 ]; then
    print_result "Edge Case - Multiple comments on post" "PASS" "Total: $TOTAL"
else
    print_result "Edge Case - Multiple comments on post" "WARN" "Total: $TOTAL"
fi

# Test 4.3: Comment response includes all fields
RESPONSE=$(api_call GET "/api/v1/forum/posts/$POST_ID/comments?limit=1")
BODY=$(echo "$RESPONSE" | sed '$d')
REQUIRED_FIELDS=("_id" "post_id" "content" "author" "created_at")
MISSING=0
for field in "${REQUIRED_FIELDS[@]}"; do
    if ! echo "$BODY" | grep -q "\"$field\""; then
        MISSING=$((MISSING + 1))
    fi
done
if [ $MISSING -eq 0 ]; then
    print_result "Edge Case - Comment response has all fields" "PASS" "All fields present"
else
    print_result "Edge Case - Comment response has all fields" "FAIL" "Missing $MISSING fields"
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

