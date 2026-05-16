/**
 * 🛡️ Auth Store
 * access_token과 userProfile을 메모리에 안전하게 보관하고,
 * 쿠키 차단을 우회하기 위한 Ghost Token(localStorage 리프레시 토큰)을 관리합니다.
 */

let accessToken = null;
let userProfile = null;
let allowedPaths = undefined; // undefined = 로컬스토리지 조회 전, null = 전체 허용 (ADMIN/SUPER_ADMIN), [] = 전체 차단, [...] = 허용 목록
const listeners = new Set();

const notify = () => {
  listeners.forEach(listener => listener({ accessToken, userProfile }));
};

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) {
    sessionStorage.setItem('sguard_access_token', token);
  } else {
    sessionStorage.removeItem('sguard_access_token');
  }
  notify();
};

export const getAccessToken = () => {
  if (!accessToken) {
    accessToken = sessionStorage.getItem('sguard_access_token');
  }
  return accessToken;
};

/**
 * 🛠️ Get standard headers with Authorization Bearer token
 */
export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extraHeaders
  };
  
  // If Content-Type is explicitly null, remove it (useful for FormData)
  if (extraHeaders['Content-Type'] === null) {
    delete headers['Content-Type'];
  }
  
  return headers;
};

export const setUserProfile = (user) => {
  userProfile = user;
  if (user) {
    localStorage.setItem('sguard_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sguard_user');
  }
  notify();
};

export const getUserProfile = () => {
  if (!userProfile) {
    const stored = localStorage.getItem('sguard_user');
    if (stored && stored !== 'null' && stored !== 'undefined') {
      try {
        userProfile = JSON.parse(stored);
      } catch (_) {
        localStorage.removeItem('sguard_user');
      }
    }
  }
  return userProfile;
};

export const setAllowedPaths = (paths) => {
  allowedPaths = paths; // null = 전체 허용, 배열 = 명시적 허용 목록
  if (paths !== null) {
    localStorage.setItem('sguard_allowed_paths', JSON.stringify(paths));
  } else {
    localStorage.removeItem('sguard_allowed_paths');
  }
};

export const getAllowedPaths = () => {
  if (allowedPaths !== undefined) return allowedPaths;
  const stored = localStorage.getItem('sguard_allowed_paths');
  if (stored && stored !== 'null' && stored !== 'undefined') {
    try {
      allowedPaths = JSON.parse(stored);
      return allowedPaths;
    } catch (_) {
      localStorage.removeItem('sguard_allowed_paths');
    }
  }
  allowedPaths = null;
  return null;
};

export const isPathAllowed = (path) => {
  // 로그인(/) 및 대시보드(/dashboard)는 공통 필수 진입점이자 권한 부족 시 Fallback 경로이므로 항상 허용
  if (path === '/' || path === '/dashboard') return true;

  const paths = getAllowedPaths();
  if (paths === null) return true; // ADMIN/SUPER_ADMIN: 전체 허용
  if (!paths || paths.length === 0) return false;
  // 경로 prefix 매칭 (예: /chat/INC-123 → /chat 허용이면 통과)
  return paths.some(p => path === p || path.startsWith(p + '/'));
};

// 👻 Ghost Token Management (LocalStorage fallback for cookies)
export const setGhostToken = (token) => {
  if (token) {
    localStorage.setItem('sguard_ghost', token);
  } else {
    localStorage.removeItem('sguard_ghost');
  }
};

export const getGhostToken = () => {
  return localStorage.getItem('sguard_ghost');
};

export const clearSession = () => {
  accessToken = null;
  userProfile = null;
  allowedPaths = undefined;
  localStorage.removeItem('sguard_user');
  localStorage.removeItem('sguard_ghost');
  localStorage.removeItem('sguard_allowed_paths');
  notify();
};

export const addAuthListener = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
