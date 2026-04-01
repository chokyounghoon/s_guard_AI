// 중앙화된 API 설정
// 로컬 개발 시에도 Cloudflare 백엔드를 사용합니다.
// 로컬 백엔드가 필요한 경우: VITE_API_BASE_URL=http://localhost:8000 (frontend/.env.local)

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.chokerslab.store';

export const SMS_WORKER_URL = import.meta.env.VITE_SMS_WORKER_URL || 'https://sguardai.khcho0421.workers.dev';

export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'wss://api.chokerslab.store';
