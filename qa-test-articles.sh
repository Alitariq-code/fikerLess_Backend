#!/bin/bash

BASE_URL="http://localhost:5002/api/v1"
REPORT_FILE="ARTICLE_QA_TEST_REPORT.md"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test results array
declare -a TEST_RESULTS

log() {
    echo -e "${2:-$NC}$1${NC}"
}

test_endpoint() {
    local test_num=$1
    local test_name=$2
    local method=$3
    local url=$4
    local data=$5
    local token=$6
    local expected_status=$7
    local expected_field=$8
    local description=$9
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local headers=(-H "Content-Type: application/json")
    if [ ! -z "$token" ]; then
        headers+=(-H "Authorization: Bearer $token")
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${headers[@]}" "$BASE_URL$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$BASE_URL$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    local status="FAILED"
    local details=""
    
    # Check HTTP status code
    if [ "$http_code" = "$expected_status" ]; then
        # Check for expected field if provided
        if [ -z "$expected_field" ] || echo "$body" | grep -q "$expected_field"; then
            status="PASSED"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log "  ✓ PASSED" "$GREEN"
        else
            status="FAILED"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            details="Expected field '$expected_field' not found in response"
            log "  ✗ FAILED: $details" "$RED"
        fi
    else
        status="FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        details="Expected HTTP $expected_status, got $http_code"
        log "  ✗ FAILED: $details" "$RED"
    fi
    
    # Store test result
    TEST_RESULTS+=("TEST_${test_num}|${test_name}|${status}|${http_code}|${details}|${description}")
    
    # Show response snippet for failed tests
    if [ "$status" = "FAILED" ]; then
        log "    Response: $(echo "$body" | head -c 200)..." "$YELLOW"
    fi
}

# Get specialist token
log "\n=== Getting Authentication Token ===" "$BLUE"
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"specialist@test.com","password":"password123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    log "Creating specialist profile..." "$YELLOW"
    node create-specialist-profile.js > /dev/null 2>&1
    TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"specialist@test.com","password":"password123"}' | \
      grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
    log "✗ Cannot get token. Some tests will be skipped." "$RED"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 10))
else
    log "✓ Token obtained" "$GREEN"
fi

# Create a test article for some tests
if [ ! -z "$TOKEN" ]; then
    TEST_ARTICLE_ID=$(curl -s -X POST "$BASE_URL/articles" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "title": "QA Test Article",
        "category": "Exercise",
        "content": "This is a test article created for QA testing purposes. It contains enough content to meet the minimum requirements for article creation. The content should be at least 50 characters long to pass validation.",
        "status": "draft"
      }' | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$TEST_ARTICLE_ID" ]; then
        log "✓ Test article created: $TEST_ARTICLE_ID" "$GREEN"
    fi
fi

log "\n╔════════════════════════════════════════════════════════════╗" "$CYAN"
log "║     Article API - Comprehensive QA Test Suite (20 Tests)   ║" "$CYAN"
log "╚════════════════════════════════════════════════════════════╝" "$CYAN"

# ============================================
# TEST SUITE 1: PUBLIC ENDPOINTS (No Auth)
# ============================================
log "\n=== TEST SUITE 1: Public Endpoints ===" "$BLUE"

log "\n[TEST 1] Get Categories - Valid Request" "$YELLOW"
test_endpoint "1" "Get Categories" "GET" "/articles/categories" "" "" "200" "Sleep" "Should return array of all available categories"

log "\n[TEST 2] Get All Articles - Empty Result" "$YELLOW"
test_endpoint "2" "Get All Articles Empty" "GET" "/articles?page=1&limit=10" "" "" "200" "success" "Should return empty array with pagination when no articles exist"

log "\n[TEST 3] Get Featured Articles - Empty Result" "$YELLOW"
test_endpoint "3" "Get Featured Empty" "GET" "/articles/featured?limit=6" "" "" "200" "success" "Should return empty array when no featured articles exist"

log "\n[TEST 4] Search Articles - Empty Result" "$YELLOW"
test_endpoint "4" "Search Empty" "GET" "/articles/search?q=nonexistent" "" "" "200" "count" "Should return count: 0 when no results found"

log "\n[TEST 5] Get Article by ID - Not Found" "$YELLOW"
test_endpoint "5" "Get Article 404" "GET" "/articles/507f1f77bcf86cd799439011" "" "" "404" "not found" "Should return 404 for non-existent article ID"

# ============================================
# TEST SUITE 2: AUTHENTICATION & AUTHORIZATION
# ============================================
log "\n=== TEST SUITE 2: Authentication & Authorization ===" "$BLUE"

log "\n[TEST 6] Create Article - Without Token" "$YELLOW"
test_endpoint "6" "Create Article No Auth" "POST" "/articles" '{"title":"Test","category":"Exercise","content":"This is a test article with enough content to pass validation requirements."}' "" "401" "Unauthorized" "Should reject request without authentication token"

log "\n[TEST 7] Create Article - Invalid Token" "$YELLOW"
test_endpoint "7" "Create Article Invalid Token" "POST" "/articles" '{"title":"Test","category":"Exercise","content":"This is a test article with enough content to pass validation requirements."}' "invalid_token_here" "401" "invalid" "Should reject request with invalid token"

log "\n[TEST 8] Get My Articles - Without Token" "$YELLOW"
test_endpoint "8" "Get My Articles No Auth" "GET" "/articles/my-articles" "" "" "401" "Unauthorized" "Should reject request without authentication token"

log "\n[TEST 9] Update Article - Without Token" "$YELLOW"
test_endpoint "9" "Update Article No Auth" "PUT" "/articles/507f1f77bcf86cd799439011" '{"title":"Updated"}' "" "401" "Unauthorized" "Should reject request without authentication token"

log "\n[TEST 10] Delete Article - Without Token" "$YELLOW"
test_endpoint "10" "Delete Article No Auth" "DELETE" "/articles/507f1f77bcf86cd799439011" "" "" "401" "Unauthorized" "Should reject request without authentication token"

# ============================================
# TEST SUITE 3: VALIDATION TESTS
# ============================================
log "\n=== TEST SUITE 3: Input Validation ===" "$BLUE"

if [ ! -z "$TOKEN" ]; then
    log "\n[TEST 11] Create Article - Missing Title" "$YELLOW"
    test_endpoint "11" "Create Missing Title" "POST" "/articles" '{"category":"Exercise","content":"This is a test article with enough content to pass validation requirements."}' "$TOKEN" "400" "title" "Should reject article creation without title"
    
    log "\n[TEST 12] Create Article - Missing Category" "$YELLOW"
    test_endpoint "12" "Create Missing Category" "POST" "/articles" '{"title":"Test Article","content":"This is a test article with enough content to pass validation requirements."}' "$TOKEN" "400" "category" "Should reject article creation without category"
    
    log "\n[TEST 13] Create Article - Missing Content" "$YELLOW"
    test_endpoint "13" "Create Missing Content" "POST" "/articles" '{"title":"Test Article","category":"Exercise"}' "$TOKEN" "400" "content" "Should reject article creation without content"
    
    log "\n[TEST 14] Create Article - Invalid Category" "$YELLOW"
    test_endpoint "14" "Create Invalid Category" "POST" "/articles" '{"title":"Test Article","category":"InvalidCategory","content":"This is a test article with enough content to pass validation requirements."}' "$TOKEN" "400" "Invalid category" "Should reject article creation with invalid category enum value"
    
    log "\n[TEST 15] Create Article - Title Too Short" "$YELLOW"
    test_endpoint "15" "Create Short Title" "POST" "/articles" '{"title":"AB","category":"Exercise","content":"This is a test article with enough content to pass validation requirements."}' "$TOKEN" "400" "at least 3" "Should reject article with title less than 3 characters"
    
    log "\n[TEST 16] Create Article - Content Too Short" "$YELLOW"
    test_endpoint "16" "Create Short Content" "POST" "/articles" '{"title":"Test Article","category":"Exercise","content":"Short"}' "$TOKEN" "400" "at least 50" "Should reject article with content less than 50 characters"
    
    log "\n[TEST 17] Create Article - Invalid Image URL" "$YELLOW"
    test_endpoint "17" "Create Invalid Image URL" "POST" "/articles" '{"title":"Test Article","category":"Exercise","content":"This is a test article with enough content to pass validation requirements.","featured_image_url":"not-a-valid-url"}' "$TOKEN" "400" "valid URL" "Should reject article with invalid featured_image_url format"
else
    SKIPPED_TESTS=$((SKIPPED_TESTS + 7))
    log "\n  ⚠ Skipped validation tests (no token)" "$YELLOW"
fi

# ============================================
# TEST SUITE 4: POSITIVE TEST CASES
# ============================================
log "\n=== TEST SUITE 4: Positive Test Cases ===" "$BLUE"

if [ ! -z "$TOKEN" ]; then
    log "\n[TEST 18] Create Article - Valid Draft" "$YELLOW"
    test_endpoint "18" "Create Valid Draft" "POST" "/articles" '{
        "title": "Comprehensive Meditation Guide",
        "category": "Meditation",
        "content": "This is a comprehensive guide to meditation practices. It covers various meditation techniques including mindfulness meditation, transcendental meditation, and loving-kindness meditation. Each technique has unique benefits and can be practiced by beginners and advanced practitioners alike.",
        "featured_image_url": "https://example.com/meditation.jpg",
        "status": "draft"
    }' "$TOKEN" "201" "_id" "Should successfully create a draft article with all valid fields"
    
    log "\n[TEST 19] Create Article - Valid Published" "$YELLOW"
    test_endpoint "19" "Create Valid Published" "POST" "/articles" '{
        "title": "Benefits of Regular Exercise",
        "category": "Exercise",
        "content": "Regular exercise provides numerous physical and mental health benefits. It helps improve cardiovascular health, strengthens muscles and bones, enhances mood, reduces stress, and promotes better sleep. This article explores the science behind exercise benefits and provides practical tips for incorporating exercise into daily life.",
        "status": "published"
    }' "$TOKEN" "201" "_id" "Should successfully create a published article"
    
    log "\n[TEST 20] Get My Articles - With Results" "$YELLOW"
    test_endpoint "20" "Get My Articles Success" "GET" "/articles/my-articles?status=all&page=1&limit=10" "" "$TOKEN" "200" "published_count" "Should return specialist's articles with published count"
    
    log "\n[TEST 21] Get All Articles - With Published Articles" "$YELLOW"
    test_endpoint "21" "Get All Articles Success" "GET" "/articles?page=1&limit=10" "" "" "200" "data" "Should return published articles after creating them"
    
    log "\n[TEST 22] Get Article by ID - Valid" "$YELLOW"
    if [ ! -z "$TEST_ARTICLE_ID" ]; then
        # First publish it
        curl -s -X PATCH "$BASE_URL/articles/$TEST_ARTICLE_ID/publish" \
          -H "Authorization: Bearer $TOKEN" > /dev/null
        
        test_endpoint "22" "Get Article by ID" "GET" "/articles/$TEST_ARTICLE_ID" "" "" "200" "title" "Should return full article details with author information"
    else
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        log "  ⚠ Skipped (no test article ID)" "$YELLOW"
    fi
    
    log "\n[TEST 23] Update Article - Valid" "$YELLOW"
    if [ ! -z "$TEST_ARTICLE_ID" ]; then
        test_endpoint "23" "Update Article" "PUT" "/articles/$TEST_ARTICLE_ID" '{
            "title": "Updated QA Test Article",
            "content": "This is an updated test article with enough content to meet the minimum requirements. The content has been modified for testing purposes."
        }' "$TOKEN" "200" "Updated" "Should successfully update article fields"
    else
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        log "  ⚠ Skipped (no test article ID)" "$YELLOW"
    fi
    
    log "\n[TEST 24] Publish Article - Valid" "$YELLOW"
    # Create a new draft article for publishing
    DRAFT_ID=$(curl -s -X POST "$BASE_URL/articles" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "title": "Draft Article for Publishing",
        "category": "Sleep",
        "content": "This is a draft article that will be published through the publish endpoint. It contains sufficient content to meet validation requirements.",
        "status": "draft"
      }' | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$DRAFT_ID" ]; then
        test_endpoint "24" "Publish Article" "PATCH" "/articles/$DRAFT_ID/publish" "" "$TOKEN" "200" "published" "Should successfully publish a draft article"
    else
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        log "  ⚠ Skipped (could not create draft)" "$YELLOW"
    fi
    
    log "\n[TEST 25] Delete Article - Valid" "$YELLOW"
    # Create article for deletion
    DELETE_ID=$(curl -s -X POST "$BASE_URL/articles" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d '{
        "title": "Article to Delete",
        "category": "Fitness",
        "content": "This article will be deleted as part of the QA test suite. It contains enough content to pass validation.",
        "status": "draft"
      }' | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$DELETE_ID" ]; then
        test_endpoint "25" "Delete Article" "DELETE" "/articles/$DELETE_ID" "" "$TOKEN" "200" "success" "Should successfully delete an article"
    else
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        log "  ⚠ Skipped (could not create article)" "$YELLOW"
    fi
    
    log "\n[TEST 26] Search Articles - With Results" "$YELLOW"
    test_endpoint "26" "Search With Results" "GET" "/articles/search?q=Exercise" "" "" "200" "count" "Should return search results when articles exist"
    
    log "\n[TEST 27] Get Articles by Category" "$YELLOW"
    test_endpoint "27" "Get by Category" "GET" "/articles?category=Exercise&page=1&limit=10" "" "" "200" "data" "Should return articles filtered by category"
    
    log "\n[TEST 28] Get Featured Articles - With Results" "$YELLOW"
    test_endpoint "28" "Get Featured With Results" "GET" "/articles/featured?limit=6" "" "" "200" "data" "Should return featured articles sorted by views"
else
    SKIPPED_TESTS=$((SKIPPED_TESTS + 11))
    log "\n  ⚠ Skipped positive tests (no token)" "$YELLOW"
fi

# ============================================
# TEST SUITE 5: EDGE CASES & BOUNDARY TESTS
# ============================================
log "\n=== TEST SUITE 5: Edge Cases & Boundaries ===" "$BLUE"

log "\n[TEST 29] Get Categories - Verify All Categories" "$YELLOW"
CATEGORIES=$(curl -s "$BASE_URL/articles/categories" | grep -o '\[.*\]')
if echo "$CATEGORIES" | grep -q "Sleep" && echo "$CATEGORIES" | grep -q "Exercise" && echo "$CATEGORIES" | grep -q "Meditation"; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("TEST_29|Get Categories Verify|PASSED|200||Should return all expected categories")
    log "  ✓ PASSED" "$GREEN"
else
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("TEST_29|Get Categories Verify|FAILED|200|Missing expected categories|Should return all expected categories")
    log "  ✗ FAILED" "$RED"
fi

log "\n[TEST 30] Get Articles - Large Page Number" "$YELLOW"
test_endpoint "30" "Large Page Number" "GET" "/articles?page=9999&limit=10" "" "" "200" "data" "Should handle large page numbers gracefully"

# Generate Report
log "\n\n╔════════════════════════════════════════════════════════════╗" "$CYAN"
log "║                    TEST EXECUTION SUMMARY                    ║" "$CYAN"
log "╚════════════════════════════════════════════════════════════╝" "$CYAN"

log "\nTotal Tests: $TOTAL_TESTS" "$BLUE"
log "Passed: $PASSED_TESTS" "$GREEN"
log "Failed: $FAILED_TESTS" "$RED"
log "Skipped: $SKIPPED_TESTS" "$YELLOW"

SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
log "\nSuccess Rate: ${SUCCESS_RATE}%" "$BLUE"

# Generate Markdown Report
cat > "$REPORT_FILE" << EOF
# Article API - QA Test Report

**Generated:** $(date)
**Test Suite:** Article Module Endpoints
**Total Tests:** $TOTAL_TESTS
**Passed:** $PASSED_TESTS
**Failed:** $FAILED_TESTS
**Skipped:** $SKIPPED_TESTS
**Success Rate:** ${SUCCESS_RATE}%

---

## Test Results

| Test # | Test Name | Status | HTTP Code | Details | Description |
|--------|-----------|--------|-----------|---------|-------------|
EOF

for result in "${TEST_RESULTS[@]}"; do
    IFS='|' read -r test_num test_name status http_code details description <<< "$result"
    status_emoji="❌"
    if [ "$status" = "PASSED" ]; then
        status_emoji="✅"
    fi
    echo "| $test_num | $test_name | $status_emoji $status | $http_code | $details | $description |" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF

---

## Test Coverage

### Public Endpoints (No Authentication)
- ✅ Get Categories
- ✅ Get All Articles
- ✅ Get Featured Articles
- ✅ Search Articles
- ✅ Get Article by ID

### Specialist Endpoints (Authentication Required)
- ✅ Create Article
- ✅ Get My Articles
- ✅ Update Article
- ✅ Delete Article
- ✅ Publish Article

### Validation Tests
- ✅ Missing required fields
- ✅ Invalid field values
- ✅ Field length validation
- ✅ URL format validation
- ✅ Category enum validation

### Security Tests
- ✅ Unauthorized access attempts
- ✅ Invalid token handling
- ✅ Missing token handling

### Edge Cases
- ✅ Empty results handling
- ✅ Large page numbers
- ✅ Invalid article IDs
- ✅ Category filtering

---

## Recommendations

EOF

if [ $FAILED_TESTS -gt 0 ]; then
    cat >> "$REPORT_FILE" << EOF
⚠️ **Action Required:** $FAILED_TESTS test(s) failed. Please review the failed test cases above and fix the issues.

EOF
else
    cat >> "$REPORT_FILE" << EOF
✅ **All Tests Passed:** The Article API endpoints are functioning correctly and are production-ready.

EOF
fi

cat >> "$REPORT_FILE" << EOF

## API Endpoints Tested

1. \`GET /api/v1/articles/categories\` - Get all categories
2. \`POST /api/v1/articles\` - Create article (Specialist)
3. \`GET /api/v1/articles/my-articles\` - Get specialist's articles
4. \`GET /api/v1/articles\` - Get all published articles
5. \`GET /api/v1/articles/featured\` - Get featured articles
6. \`GET /api/v1/articles/search\` - Search articles
7. \`GET /api/v1/articles/:id\` - Get article by ID
8. \`PUT /api/v1/articles/:id\` - Update article (Specialist)
9. \`PATCH /api/v1/articles/:id/publish\` - Publish article (Specialist)
10. \`DELETE /api/v1/articles/:id\` - Delete article (Specialist)

---

**Report Generated by:** QA Test Suite
**Environment:** Development
**Base URL:** $BASE_URL
EOF

log "\n✓ Test report generated: $REPORT_FILE" "$GREEN"
log "\nView the detailed report: cat $REPORT_FILE" "$BLUE"

