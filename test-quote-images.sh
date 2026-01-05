#!/bin/bash

# Test script for quote images endpoint
BASE_URL="${BASE_URL:-http://localhost:5002}"
ENDPOINT="/api/v1/quote/images/random"

echo "=========================================="
echo "Testing Quote Images Endpoint"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Endpoint: $ENDPOINT"
echo ""

# Test 1: Get random quote images
echo "Test 1: Getting 3 random quote images..."
echo "----------------------------------------"
RESPONSE=$(curl -s -X GET "$BASE_URL$ENDPOINT" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract URLs from response
URLS=$(echo "$RESPONSE" | jq -r '.data[]' 2>/dev/null)

if [ -z "$URLS" ]; then
  echo "❌ ERROR: No URLs found in response"
  exit 1
fi

echo "✅ Successfully received quote image URLs:"
echo "$URLS" | while read -r url; do
  echo "  - $url"
done
echo ""

# Test 2: Verify URLs are accessible
echo "Test 2: Verifying image URLs are accessible..."
echo "----------------------------------------"
echo "$URLS" | while read -r url; do
  echo "Testing: $url"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✅ $url - Accessible (HTTP $HTTP_CODE)"
  else
    echo "  ❌ $url - Not accessible (HTTP $HTTP_CODE)"
  fi
done
echo ""

# Test 3: Multiple calls to verify randomness
echo "Test 3: Testing randomness (3 calls)..."
echo "----------------------------------------"
for i in {1..3}; do
  echo "Call $i:"
  RESPONSE=$(curl -s -X GET "$BASE_URL$ENDPOINT")
  URLS=$(echo "$RESPONSE" | jq -r '.data[]' 2>/dev/null)
  echo "$URLS" | while read -r url; do
    filename=$(basename "$url")
    echo "  - $filename"
  done
  echo ""
done

echo "=========================================="
echo "Testing Complete"
echo "=========================================="

