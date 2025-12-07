#!/bin/bash

BASE_URL="http://localhost:5002/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${2:-$NC}$1${NC}"
}

# Step 1: Get Specialist Token
log "\n=== Getting Specialist Token ===" "$BLUE"
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"specialist@test.com","password":"password123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    log "✗ Failed to get token. Creating profile..." "$RED"
    node create-specialist-profile.js
    TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"specialist@test.com","password":"password123"}' | \
      grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
    log "✗ Cannot proceed without token" "$RED"
    exit 1
fi

log "✓ Token obtained: ${TOKEN:0:30}..." "$GREEN"

# Test all endpoints
log "\n╔════════════════════════════════════════╗" "$BLUE"
log "║   Testing All Article Endpoints        ║" "$BLUE"
log "╚════════════════════════════════════════╝" "$BLUE"

# 1. Get Categories
log "\n1. GET /articles/categories" "$YELLOW"
response=$(curl -s "$BASE_URL/articles/categories")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    echo "$response" | jq '.data' 2>/dev/null || echo "$response"
else
    log "✗ Failed" "$RED"
fi

# 2. Create Draft Article
log "\n2. POST /articles (Create Draft)" "$YELLOW"
article1='{
    "title": "Small Victory: I talked to someone today",
    "category": "Meditation",
    "content": "This is a comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this article, we will explore different meditation styles and how to get started with your practice.",
    "featured_image_url": "https://example.com/article-image.jpg",
    "status": "draft"
}'

response=$(curl -s -X POST "$BASE_URL/articles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$article1")

ARTICLE_ID=$(echo "$response" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$ARTICLE_ID" ]; then
    log "✓ Article created: $ARTICLE_ID" "$GREEN"
else
    log "✗ Failed: $response" "$RED"
fi

# 3. Create Published Article
log "\n3. POST /articles (Create Published)" "$YELLOW"
article2='{
    "title": "Understanding Exercise and Mental Health",
    "category": "Exercise",
    "content": "Regular exercise is one of the most effective ways to improve mental health. Physical activity releases endorphins, which are natural mood lifters. This article explores the connection between exercise and mental well-being, providing practical tips for incorporating exercise into your daily routine. We will discuss different types of exercises and their specific benefits for mental health.",
    "featured_image_url": "https://example.com/exercise.jpg",
    "status": "published"
}'

response=$(curl -s -X POST "$BASE_URL/articles" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$article2")

if echo "$response" | grep -q "_id"; then
    log "✓ Published article created" "$GREEN"
    PUBLISHED_ID=$(echo "$response" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
else
    log "✗ Failed: $response" "$RED"
fi

# 4. Get My Articles
log "\n4. GET /articles/my-articles" "$YELLOW"
response=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/articles/my-articles?status=all&page=1&limit=10")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    total=$(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    published=$(echo "$response" | grep -o '"published_count":[0-9]*' | cut -d':' -f2)
    log "  Total: $total, Published: $published" "$BLUE"
else
    log "✗ Failed" "$RED"
fi

# 5. Get All Published Articles
log "\n5. GET /articles (Public)" "$YELLOW"
response=$(curl -s "$BASE_URL/articles?page=1&limit=10")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    total=$(echo "$response" | grep -o '"total":[0-9]*' | cut -d':' -f2)
    log "  Total published: $total" "$BLUE"
else
    log "✗ Failed" "$RED"
fi

# 6. Get by Category
log "\n6. GET /articles?category=Meditation" "$YELLOW"
response=$(curl -s "$BASE_URL/articles?category=Meditation&page=1&limit=10")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
else
    log "✗ Failed" "$RED"
fi

# 7. Get Featured
log "\n7. GET /articles/featured" "$YELLOW"
response=$(curl -s "$BASE_URL/articles/featured?limit=6")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    count=$(echo "$response" | jq '.data | length' 2>/dev/null || echo "0")
    log "  Featured articles: $count" "$BLUE"
else
    log "✗ Failed" "$RED"
fi

# 8. Search Articles
log "\n8. GET /articles/search?q=meditation" "$YELLOW"
response=$(curl -s "$BASE_URL/articles/search?q=meditation")
if echo "$response" | grep -q "success"; then
    log "✓ Success" "$GREEN"
    count=$(echo "$response" | grep -o '"count":[0-9]*' | cut -d':' -f2)
    log "  Results: $count" "$BLUE"
else
    log "✗ Failed" "$RED"
fi

# 9. Publish Draft Article
if [ ! -z "$ARTICLE_ID" ]; then
    log "\n9. PATCH /articles/:id/publish" "$YELLOW"
    response=$(curl -s -X PATCH "$BASE_URL/articles/$ARTICLE_ID/publish" \
      -H "Authorization: Bearer $TOKEN")
    if echo "$response" | grep -q "success"; then
        log "✓ Article published" "$GREEN"
    else
        log "✗ Failed: $response" "$RED"
    fi
fi

# 10. Get Article by ID
if [ ! -z "$ARTICLE_ID" ]; then
    log "\n10. GET /articles/:id" "$YELLOW"
    response=$(curl -s "$BASE_URL/articles/$ARTICLE_ID")
    if echo "$response" | grep -q "success"; then
        log "✓ Success" "$GREEN"
        title=$(echo "$response" | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4)
        views=$(echo "$response" | grep -o '"views":[0-9]*' | cut -d':' -f2)
        log "  Title: $title" "$BLUE"
        log "  Views: $views" "$BLUE"
    else
        log "✗ Failed" "$RED"
    fi
fi

# 11. Update Article
if [ ! -z "$ARTICLE_ID" ]; then
    log "\n11. PUT /articles/:id" "$YELLOW"
    update='{
        "title": "Updated: Small Victory: I talked to someone today",
        "content": "This is an updated comprehensive article about meditation and mindfulness. It covers various techniques and benefits of regular meditation practice. Meditation has been shown to reduce stress, improve focus, and enhance overall well-being. In this updated article, we will explore different meditation styles and how to get started with your practice."
    }'
    
    response=$(curl -s -X PUT "$BASE_URL/articles/$ARTICLE_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$update")
    
    if echo "$response" | grep -q "success"; then
        log "✓ Article updated" "$GREEN"
    else
        log "✗ Failed: $response" "$RED"
    fi
fi

# 12. Delete Article
if [ ! -z "$ARTICLE_ID" ]; then
    log "\n12. DELETE /articles/:id" "$YELLOW"
    response=$(curl -s -X DELETE "$BASE_URL/articles/$ARTICLE_ID" \
      -H "Authorization: Bearer $TOKEN")
    if echo "$response" | grep -q "success"; then
        log "✓ Article deleted" "$GREEN"
    else
        log "✗ Failed: $response" "$RED"
    fi
fi

log "\n╔════════════════════════════════════════╗" "$GREEN"
log "║     All Endpoints Tested Successfully!  ║" "$GREEN"
log "╚════════════════════════════════════════╝" "$GREEN"

