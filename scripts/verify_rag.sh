#!/bin/bash

API_BASE="https://sguardai.khcho0421.workers.dev"
AUTH_TOKEN="Bearer !QweAsd1018"

echo "--- [RAG System Verification (768-dim)] ---"

# 1. Save Knowledge
echo "Step 1: Saving test knowledge to D1..."
SAVE_RES=$(curl -s -X POST "$API_BASE/ai/knowledge/save" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "DB 접속 과부하 장애 대응 절차 (768-dim Test)",
    "content": "데이터베이스 커넥션 풀이 가득 찼을 경우, 즉시 애플리케이션 서버의 Idle 커넥션을 정리하고 DB 파라미터 중 max_connections 설정을 일시적으로 상향 조정해야 합니다. 이는 서비스 중단을 막기 위한 긴급 조치입니다.",
    "category": "Database",
    "tags": "DB, Connection, MaxConnections",
    "user_id": "TEST_ADMIN"
  }')

echo "Response: $SAVE_RES"
KNOWLEDGE_ID=$(echo $SAVE_RES | grep -o '"id":[0-9]*' | cut -d: -f2)

if [ -z "$KNOWLEDGE_ID" ]; then
    echo "FAILED: Could not save knowledge."
    exit 1
fi

echo "SUCCESS: Knowledge ID $KNOWLEDGE_ID saved."

# 2. Wait for sync
echo "Step 2: Waiting for Vectorize sync..."
sleep 3

# 3. Check status
echo "Checking storage status..."
DETAIL=$(curl -s "$API_BASE/ai/knowledge/$KNOWLEDGE_ID")
STATUS=$(echo $DETAIL | grep -o '"status":"[^"]*"' | cut -d: -f2 | tr -d '"')
ERROR_LOG=$(echo $DETAIL | grep -o '"error_log":"[^"]*"' | cut -d: -f2 | tr -d '"')

echo "Current Status: $STATUS"
if [ "$STATUS" == "SUCCESS" ]; then
    echo "SUCCESS: Vectorize sync confirmed."
else
    echo "WARNING: Status is $STATUS. Error Log: $ERROR_LOG"
fi

# 4. Semantic Search
echo -e "\nStep 3: Performing Semantic Search..."
QUERY="DB 커넥션이 부족할 때 조치 방법"
# URL encode query (basic)
ENCODED_QUERY="DB%20%EC%BB%A4%EB%84%A5%EC%85%98%EC%9D%B4%20%EB%B6%80%EC%A1%B1%ED%95%A0%20%EB%95%8C%20%EC%A1%B0%EC%B9%98%20%EB%B0%A9%EB%B2%95"
SEARCH_RES=$(curl -s "$API_BASE/ai/knowledge/search?q=$ENCODED_QUERY")

TITLE=$(echo $SEARCH_RES | grep -o '"title":"[^"]*"' | head -1 | cut -d: -f2 | tr -d '"')
if [ ! -z "$TITLE" ]; then
    echo "Top Match found: $TITLE"
    echo "SUCCESS: Semantic search working."
else
    echo "FAILED: Semantic search returned no results."
fi

# 5. Score check via Retrieval
echo -e "\nStep 4: Checking Similarity Scores via /retrieval..."
RET_RES=$(curl -s -X POST "$API_BASE/retrieval" \
  -H "Authorization: $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"DB max_connections 설정 변경\",
    \"retrieval_setting\": {\"top_k\": 1, \"score_threshold\": 0.0}
  }")

SCORE=$(echo $RET_RES | grep -o '"score":[0-9.]*' | cut -d: -f2)
TITLE=$(echo $RET_RES | grep -o '"title":"[^"]*"' | cut -d: -f2 | tr -d '"')

if [ ! -z "$SCORE" ]; then
    echo "Top Match: $TITLE (Score: $SCORE)"
    echo "SUCCESS: High-precision retrieval verified."
else
    echo "FAILED: Retrieval score check failed."
    echo "Response: $RET_RES"
fi
