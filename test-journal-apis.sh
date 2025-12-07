#!/bin/bash

# Test script for Journal API endpoints
BASE_URL="${BASE_URL:-http://localhost:5002}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

echo "=========================================="
echo "Journal API Endpoints Test"
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
        curl -s -X "$method" "$BASE_URL$endpoint"
    fi
}

test_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    echo "  Response: $2"
    ((FAILED++))
}

# Step 0: Create test user in database
echo "Step 0: Creating test user in database..."
cd /home/alicode/Desktop/fikerLess_Backend

# Generate password hash (using a known working hash)
PASSWORD_HASH=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash('password123', 10).then(hash => console.log(hash)).catch(e => console.error(e));" 2>/dev/null)

# If hash generation failed, use a pre-computed hash
if [ -z "$PASSWORD_HASH" ] || [ ${#PASSWORD_HASH} -lt 50 ]; then
    PASSWORD_HASH='$2b$10$77BiL3KLkkTDQxYWVOZ2juxs0xv6YV9ATTtxU3oapHYQd654r6px2'
fi

# Find MongoDB container (try common names)
MONGO_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep -E 'mongo|db' | head -1)
if [ -z "$MONGO_CONTAINER" ]; then
    # Try specific names
    if docker ps -a --format '{{.Names}}' | grep -q "^db$"; then
        MONGO_CONTAINER="db"
    elif docker ps -a --format '{{.Names}}' | grep -q "fikrless-mongodb"; then
        MONGO_CONTAINER="fikrless-mongodb"
    else
        echo -e "${RED}✗ MongoDB container not found${NC}"
        exit 1
    fi
fi
echo "Using MongoDB container: $MONGO_CONTAINER"

# Create regular user (not specialist) for testing - journal doesn't require specialist
DB_RESULT=$(docker exec -i "$MONGO_CONTAINER" mongosh fikrless --quiet --eval "
// Create regular user for journal testing
var user = db.users.findOne({email: 'user@test.com'});
if (!user) {
  db.users.insertOne({
    email: 'user@test.com',
    password: '$PASSWORD_HASH',
    user_type: 'user',
    is_email_verified: true,
    has_demographics: true,
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+1234567890',
    otp_token: '1234'
  });
  print('User created');
} else {
  db.users.updateOne(
    {email: 'user@test.com'},
    {\$set: {password: '$PASSWORD_HASH', is_email_verified: true, has_demographics: true}}
  );
  print('User updated');
}
" 2>&1)

if echo "$DB_RESULT" | grep -q "User\|Profile"; then
    test_pass "User and profile created in database"
else
    echo "Database result: $DB_RESULT"
    test_fail "Failed to create user in database"
    exit 1
fi
echo ""

# Step 1: Login (using regular user, not specialist)
echo "Step 1: Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"user@test.com","password":"password123"}')
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Failed to get token${NC}"
    echo "Login response: $LOGIN_RESPONSE"
    exit 1
fi
test_pass "Login successful - Token obtained"
echo ""

# Step 2: Get Today's Journal (should be empty)
echo "Step 2: Get Today's Journal..."
RESPONSE=$(api_call "GET" "/api/v1/journal/today" "$TOKEN")
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
    test_pass "Get Today's Journal"
else
    test_fail "Get Today's Journal" "$RESPONSE"
fi
echo ""

# Step 3: Create Journal Entry for Today
echo "Step 3: Create Journal Entry for Today..."
TODAY=$(date +%Y-%m-%d)
CREATE_DATA="{\"date\":\"$TODAY\",\"content\":\"Had a good conversation with friends today. Feeling positive and grateful.\",\"mood\":\"happy\"}"
CREATE_RESPONSE=$(api_call "POST" "/api/v1/journal" "$TOKEN" "$CREATE_DATA")
JOURNAL_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
SUCCESS=$(echo "$CREATE_RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ] && [ -n "$JOURNAL_ID" ]; then
    test_pass "Create Journal Entry - ID: $JOURNAL_ID"
else
    test_fail "Create Journal Entry" "$CREATE_RESPONSE"
    exit 1
fi
echo ""

# Step 4: Get Today's Journal (should have entry now)
echo "Step 4: Get Today's Journal (with entry)..."
RESPONSE=$(api_call "GET" "/api/v1/journal/today" "$TOKEN")
HAS_DATA=$(echo "$RESPONSE" | grep -o '"_id"')

if [ -n "$HAS_DATA" ]; then
    test_pass "Get Today's Journal - Entry found"
else
    test_fail "Get Today's Journal - Entry not found" "$RESPONSE"
fi
echo ""

# Step 5: Get Journal by Date
echo "Step 5: Get Journal by Date..."
RESPONSE=$(api_call "GET" "/api/v1/journal/date/$TODAY" "$TOKEN")
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
HAS_DATA=$(echo "$RESPONSE" | grep -o '"_id"')

if [ -n "$SUCCESS" ] && [ -n "$HAS_DATA" ]; then
    test_pass "Get Journal by Date"
else
    test_fail "Get Journal by Date" "$RESPONSE"
fi
echo ""

# Step 6: Create Another Entry (Yesterday)
echo "Step 6: Create Journal Entry for Yesterday..."
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d 2>/dev/null || echo "$(date -d '1 day ago' +%Y-%m-%d)")
CREATE_DATA="{\"date\":\"$YESTERDAY\",\"content\":\"Had a good conversation with friends\",\"mood\":\"sad\"}"
CREATE_RESPONSE=$(api_call "POST" "/api/v1/journal" "$TOKEN" "$CREATE_DATA")
SUCCESS=$(echo "$CREATE_RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
    test_pass "Create Journal Entry for Yesterday"
else
    test_fail "Create Journal Entry for Yesterday" "$CREATE_RESPONSE"
fi
echo ""

# Step 7: Get Previous Entries
echo "Step 7: Get Previous Entries..."
RESPONSE=$(api_call "GET" "/api/v1/journal/entries?page=1&limit=10" "$TOKEN")
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
HAS_DATA=$(echo "$RESPONSE" | grep -o '"_id"')

if [ -n "$SUCCESS" ] && [ -n "$HAS_DATA" ]; then
    test_pass "Get Previous Entries"
else
    test_fail "Get Previous Entries" "$RESPONSE"
fi
echo ""

# Step 8: Get Journal by Month
echo "Step 8: Get Journal by Month..."
CURRENT_YEAR=$(date +%Y)
CURRENT_MONTH=$(date +%m)
RESPONSE=$(api_call "GET" "/api/v1/journal/month?year=$CURRENT_YEAR&month=$CURRENT_MONTH" "$TOKEN")
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
    test_pass "Get Journal by Month"
else
    test_fail "Get Journal by Month" "$RESPONSE"
fi
echo ""

# Step 9: Update Journal Entry
echo "Step 9: Update Journal Entry..."
UPDATE_DATA="{\"content\":\"Updated: Had a great conversation with friends today. Feeling very positive!\",\"mood\":\"happy\"}"
UPDATE_RESPONSE=$(api_call "PUT" "/api/v1/journal/$JOURNAL_ID" "$TOKEN" "$UPDATE_DATA")
SUCCESS=$(echo "$UPDATE_RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
    test_pass "Update Journal Entry"
else
    test_fail "Update Journal Entry" "$UPDATE_RESPONSE"
fi
echo ""

# Step 10: Get Journal by ID
echo "Step 10: Get Journal by ID..."
RESPONSE=$(api_call "GET" "/api/v1/journal/$JOURNAL_ID" "$TOKEN")
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true')
HAS_UPDATED=$(echo "$RESPONSE" | grep -o "Updated:")

if [ -n "$SUCCESS" ] && [ -n "$HAS_UPDATED" ]; then
    test_pass "Get Journal by ID - Updated content found"
else
    test_fail "Get Journal by ID" "$RESPONSE"
fi
echo ""

# Step 11: Delete Journal Entry
echo "Step 11: Delete Journal Entry..."
DELETE_RESPONSE=$(api_call "DELETE" "/api/v1/journal/$JOURNAL_ID" "$TOKEN")
SUCCESS=$(echo "$DELETE_RESPONSE" | grep -o '"success":true')

if [ -n "$SUCCESS" ]; then
    test_pass "Delete Journal Entry"
else
    test_fail "Delete Journal Entry" "$DELETE_RESPONSE"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi

