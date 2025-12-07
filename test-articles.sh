#!/bin/bash

# Test script for Article endpoints
# Make sure MongoDB and backend are running

BASE_URL="http://localhost:5002/api/v1"
TOKEN="" # Will be set after login

echo "=== Testing Article Endpoints ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Get Categories (Public)
echo -e "${YELLOW}Test 1: GET /articles/categories${NC}"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/articles/categories")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi
echo ""

# Test 2: Get Articles (Public - Empty)
echo -e "${YELLOW}Test 2: GET /articles (Public)${NC}"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/articles")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi
echo ""

# Test 3: Get Featured Articles (Public)
echo -e "${YELLOW}Test 3: GET /articles/featured${NC}"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/articles/featured")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi
echo ""

# Test 4: Search Articles (Public)
echo -e "${YELLOW}Test 4: GET /articles/search?q=meditation${NC}"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/articles/search?q=meditation")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
if [ "$http_code" == "200" ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
fi
echo ""

# Note: To test specialist endpoints, you need to:
# 1. Create a specialist account
# 2. Login to get a token
# 3. Use the token in Authorization header

echo -e "${YELLOW}Note: Specialist endpoints require authentication.${NC}"
echo "To test them, login as a specialist and use the token:"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' -X POST $BASE_URL/articles -H 'Content-Type: application/json' -d '{...}'"
echo ""

