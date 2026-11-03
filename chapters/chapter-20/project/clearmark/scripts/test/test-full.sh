#!/bin/bash

# Comprehensive test script for ClearMark API
API_URL="http://localhost:8000"

echo "======================================"
echo "ClearMark Full Feature Test"
echo "======================================"
echo ""

# Test 1: Health Check
echo "1. Health Check..."
HEALTH=$(curl -s --max-time 5 "$API_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo "✅ Backend is healthy"
    echo "$HEALTH" | python3 -m json.tool 2>/dev/null || echo "$HEALTH"
else
    echo "❌ Backend health check failed"
    echo "$HEALTH"
    exit 1
fi
echo ""

# Test 2: User Registration
echo "2. User Registration..."
REGISTER_EMAIL="test$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -s --max-time 5 -X POST "$API_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$REGISTER_EMAIL\",
        \"password\": \"your-test-password\",
        \"full_name\": \"Test User\"
    }")

REGISTER_STATUS=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('ok' if 'access_token' in d else 'fail')" 2>/dev/null || echo "fail")

if [ "$REGISTER_STATUS" == "ok" ]; then
    echo "✅ User registration successful"
    TOKEN=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)
    USER_ID=$(echo "$REGISTER_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))" 2>/dev/null)
    echo "   User ID: $USER_ID"
    echo "   Token: ${TOKEN:0:30}..."
else
    echo "❌ User registration failed"
    echo "$REGISTER_RESPONSE"
    TOKEN=""
fi
echo ""

# Test 3: User Login
echo "3. User Login..."
LOGIN_RESPONSE=$(curl -s --max-time 5 -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$REGISTER_EMAIL\",
        \"password\": \"your-test-password\"
    }")

LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('ok' if 'access_token' in d else 'fail')" 2>/dev/null || echo "fail")

if [ "$LOGIN_STATUS" == "ok" ]; then
    echo "✅ User login successful"
    TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null)
else
    echo "❌ User login failed"
    echo "$LOGIN_RESPONSE"
fi
echo ""

# Test 4: Get Current User
if [ ! -z "$TOKEN" ]; then
    echo "4. Get Current User..."
    ME_RESPONSE=$(curl -s --max-time 5 -X GET "$API_URL/api/auth/me" \
        -H "Authorization: Bearer $TOKEN")
    
    if echo "$ME_RESPONSE" | grep -q "email"; then
        echo "✅ Get current user successful"
        echo "$ME_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ME_RESPONSE"
    else
        echo "❌ Get current user failed"
        echo "$ME_RESPONSE"
    fi
    echo ""
fi

# Test 5: Get Posts (Public)
echo "5. Get Posts (Public)..."
POSTS_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/posts")
if echo "$POSTS_RESPONSE" | grep -q "\[" || echo "$POSTS_RESPONSE" | grep -q "id"; then
    echo "✅ Get posts successful"
    POST_COUNT=$(echo "$POSTS_RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
    echo "   Found $POST_COUNT posts"
    echo "$POSTS_RESPONSE" | python3 -m json.tool 2>/dev/null | head -10 || echo "$POSTS_RESPONSE" | head -5
else
    echo "❌ Get posts failed"
    echo "$POSTS_RESPONSE"
fi
echo ""

# Test 6: Create Post (Authenticated)
if [ ! -z "$TOKEN" ]; then
    echo "6. Create Post (Authenticated)..."
    CREATE_RESPONSE=$(curl -s --max-time 5 -X POST "$API_URL/api/posts" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "title": "Test Post - API Test",
            "content": "# Test Post\n\nThis is a **test** post with Markdown.\n\n## Features\n\n- Markdown support\n- Code highlighting\n- Image galleries",
            "tags": ["test", "markdown", "docker"],
            "published": true
        }')
    
    CREATE_STATUS=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; d=json.load(sys.stdin); print('ok' if 'id' in d else 'fail')" 2>/dev/null || echo "fail")
    
    if [ "$CREATE_STATUS" == "ok" ]; then
        echo "✅ Create post successful"
        POST_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
        echo "   Post ID: $POST_ID"
        echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null | head -15
        echo ""
        
        # Test 7: Get Single Post
        echo "7. Get Single Post..."
        GET_RESPONSE=$(curl -s --max-time 5 "$API_URL/api/posts/$POST_ID")
        if echo "$GET_RESPONSE" | grep -q "id"; then
            echo "✅ Get single post successful"
            echo "$GET_RESPONSE" | python3 -m json.tool 2>/dev/null | head -15 || echo "$GET_RESPONSE" | head -10
        else
            echo "❌ Get single post failed"
            echo "$GET_RESPONSE"
        fi
        echo ""
        
        # Test 8: Update Post
        echo "8. Update Post..."
        UPDATE_RESPONSE=$(curl -s --max-time 5 -X PUT "$API_URL/api/posts/$POST_ID" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d '{
                "title": "Updated Test Post",
                "published": false
            }')
        
        if echo "$UPDATE_RESPONSE" | grep -q "Updated Test Post"; then
            echo "✅ Update post successful"
            echo "$UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null | head -10
        else
            echo "❌ Update post failed"
            echo "$UPDATE_RESPONSE"
        fi
        echo ""
        
        # Test 9: Delete Post
        echo "9. Delete Post..."
        DELETE_RESPONSE=$(curl -s --max-time 5 -X DELETE "$API_URL/api/posts/$POST_ID" \
            -H "Authorization: Bearer $TOKEN")
        
        if echo "$DELETE_RESPONSE" | grep -q "successfully"; then
            echo "✅ Delete post successful"
            echo "$DELETE_RESPONSE"
        else
            echo "❌ Delete post failed"
            echo "$DELETE_RESPONSE"
        fi
        echo ""
    else
        echo "❌ Create post failed"
        echo "$CREATE_RESPONSE"
    fi
else
    echo "⚠️  Skipping authenticated tests (no token)"
fi

echo "======================================"
echo "Test Complete"
echo "======================================"
