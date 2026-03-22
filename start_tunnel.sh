#!/usr/bin/env zsh
# S-Guard - Local Backend Tunnel Setup Script
# 이 스크립트를 실행하면 로컬 FastAPI(8000번 포트)를 인터넷에 노출하고
# Cloudflare Worker의 BACKEND_URL 환경변수를 자동으로 업데이트합니다.

set -e

WORKER_DIR="$(dirname "$0")/workers/sms-api"
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

echo "====================================================="
echo "  S-Guard Local Backend -> Cloudflare Tunnel Setup"
echo "====================================================="

# 1. cloudflared 설치 확인
if ! command -v cloudflared &> /dev/null; then
  echo "🔧 cloudflared를 설치합니다..."
  if command -v brew &> /dev/null; then
    brew install cloudflared
  else
    echo "❌ Homebrew가 없습니다. https://brew.sh 에서 먼저 설치하거나"
    echo "   직접 cloudflared를 설치하세요: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
fi

# 2. 로컬 백엔드(FastAPI) 실행 확인
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
  echo "⚠️  Warning: localhost:8000이 응답하지 않습니다."
  echo "   먼저 Docker Compose를 실행하세요: cd $(dirname "$0") && docker compose up -d"
fi

# 3. cloudflared로 tunneling 시작 (백그라운드)
echo "🌐 Cloudflare Tunnel 연결 중..."
TUNNEL_LOG=$(mktemp)
cloudflared tunnel --url http://localhost:8000 --logfile "$TUNNEL_LOG" &
CFPID=$!

# 터널 URL이 뜰 때까지 대기 (최대 15초)
TUNNEL_URL=""
for i in $(seq 1 15); do
  sleep 1
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
done

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ 터널 URL을 가져오지 못했습니다. 로그 확인: $TUNNEL_LOG"
  kill $CFPID 2>/dev/null
  exit 1
fi

echo ""
echo "✅ 터널 생성 완료!"
echo "   Local Backend URL: $TUNNEL_URL"

# 4. wrangler secret push (Cloudflare Worker BACKEND_URL 업데이트)
if [ -n "$CF_TOKEN" ]; then
  echo ""
  echo "🔐 Cloudflare Worker BACKEND_URL 업데이트 중..."
  cd "$WORKER_DIR"
  echo -n "$TUNNEL_URL" | CLOUDFLARE_API_TOKEN="$CF_TOKEN" npx wrangler secret put BACKEND_URL
  echo ""
  echo "🚀 재배포 중..."
  CLOUDFLARE_API_TOKEN="$CF_TOKEN" npx wrangler deploy
  echo ""
  echo "🎉 완료! 이제 S-Guard 대시보드에서 Dify AI 분석이 동작합니다."
else
  echo ""
  echo "⚠️  CLOUDFLARE_API_TOKEN 환경변수가 없어서 Worker 자동 업데이트를 건너뜁니다."
  echo "   아래 명령어를 직접 실행하세요:"
  echo ""
  echo "   export CLOUDFLARE_API_TOKEN='YOUR_TOKEN'"
  echo "   cd $WORKER_DIR"
  echo "   echo -n '$TUNNEL_URL' | npx wrangler secret put BACKEND_URL"
  echo "   npx wrangler deploy"
fi

echo ""
echo "터널 종료: kill $CFPID"
echo "(이 터널은 컴퓨터가 재시작되거나 스크립트를 종료하면 끊어집니다)"

# 5. 터널 프로세스를 포그라운드로 유지
wait $CFPID
