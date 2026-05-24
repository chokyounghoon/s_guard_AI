/**
 * 🛡️ Auth Store
 * access_token과 userProfile을 메모리에 안전하게 보관하고,
 * 쿠키 차단을 우회하기 위한 Ghost Token(localStorage 리프레시 토큰)을 관리합니다.
 *
 * allowedPaths 상태:
 *   undefined = setUserProfile 아직 호출 안됨 (초기)
 *   'loading'  = 서버 fetch 중 (전체허용으로 처리)
 *   null       = 전체 허용 (ADMIN/SUPER_ADMIN)
 *   [...]      = 서버로부터 받은 실제 허용 목록
 */

let accessToken = null;
let userProfile = null;
let allowedPaths = undefined;
const listeners = new Set();

const notify = () => {
  listeners.forEach(listener => listener({ accessToken, userProfile, allowedPaths: getAllowedPaths() }));
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

export const fetchAndApplyPermissions = async (roleInput) => {
  const u = getUserProfile();
  const role = roleInput || u?.role || u?.role_code;
  if (!role) return;
  const r = String(role).toUpperCase();
  if (r === 'SUPER_ADMIN' || r === 'ADMIN') {
    setAllowedPaths(null);
    return;
  }
  try {
    const apiBase = 'https://sguardai.khcho0421.workers.dev';
    const res = await fetch(`${apiBase}/rbac/permissions/${role}`);
    const d = await res.json();
    if (d.permissions) {
      const paths = d.permissions
        .filter(p => p.can_read === 1)
        .map(p => p.path || p.menu_path)
        .filter(Boolean);
      // 권한 목록이 비어있으면 []를 저장하여 전면 차단되도록 함 (null은 전체허용이므로 안됨)
      setAllowedPaths(paths.length > 0 ? paths : []);
    } else {
      setAllowedPaths([]);
    }
  } catch (e) {
    console.error('[RBAC Fallback] fetchAndApplyPermissions 실패:', e);
    setAllowedPaths(null); // 에러 시에만 기존 정책(Fail-Safe 전체허용) 유지
  }
};

export const setUserProfile = (user) => {
  userProfile = user;
  if (user) {
    localStorage.setItem('sguard_user', JSON.stringify(user));
    // NOTE: 권한(allowedPaths) fetch는 더 이상 여기서 자동 수행하지 않음.
    // App.jsx에서 명시적으로 서버 응답(refreshData.allowed_paths)을 받아
    // setAllowedPaths()를 호출하거나, 직접 fetchAndApplyPermissions()를 호출해야 함.
    // 이는 Race Condition 방지 위함임.
  } else {
    localStorage.removeItem('sguard_user');
    localStorage.removeItem('sguard_allowed_paths');
    allowedPaths = undefined;
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
  if (paths !== null && paths !== undefined && paths !== 'loading') {
    localStorage.setItem('sguard_allowed_paths', JSON.stringify(paths));
  } else {
    localStorage.removeItem('sguard_allowed_paths');
  }
  notify();
};

export const getAllowedPaths = () => {
  // 실제 값이 메모리에 있으면 바로 반환
  if (allowedPaths !== null && allowedPaths !== undefined && allowedPaths !== 'loading') {
    return allowedPaths;
  }
  
  // 메모리에 없으면 localStorage에서 로드 시도
  const storedPaths = localStorage.getItem('sguard_allowed_paths');
  if (storedPaths) {
    try {
      const parsed = JSON.parse(storedPaths);
      if (Array.isArray(parsed)) {
        allowedPaths = parsed;
        return parsed;
      }
    } catch (e) {
      localStorage.removeItem('sguard_allowed_paths');
    }
  }

  // 'loading' 마커 또는 undefined → 서버 fetch 아직 완료 안됨 → null(전체허용) 반환
  if (allowedPaths === 'loading' || allowedPaths === undefined) {
    return null;
  }
  
  // null = 명시적 전체허용
  return null;
};

export const isPathAllowed = (path) => {
  if (!path) return true;
  if (path === '/' || path === '/dashboard' || path.startsWith('/dashboard/') || path === '/realtime-pipeline') return true;

  const u = getUserProfile();
  if (u && (u.role === 'SUPER_ADMIN' || u.role === 'ADMIN' || u.role === 'super_admin' || u.role === 'admin' || u.is_admin === 1)) {
    return true;
  }

  const paths = getAllowedPaths();
  // null/undefined = 로딩 중이거나 전체허용 → true
  if (paths === null || paths === undefined) return true;
  // 배열이고 요소가 없으면 명시적으로 권한이 없는 것(전면차단)
  if (!Array.isArray(paths)) return true;
  if (paths.length === 0) return false;
  
  // 🔗 하위 경로를 상위 권한 경로로 매핑 (Nested Routes Mapping)
  const aliasMap = {
    '/chat-summary': '/chat',
    '/activity-detail': '/activity',
    '/assignment-detail': '/assignments',
    '/my-assignments': '/assignments',
    '/mobile-report-search': '/search',
    '/workflow': '/incident-list',
    '/report': '/incident-list'
  };

  for (const [childPath, parentPath] of Object.entries(aliasMap)) {
    if (path === childPath || path.startsWith(childPath + '/')) {
      if (paths.some(p => parentPath === p || parentPath.startsWith(p + '/'))) {
        return true;
      }
    }
  }
  
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
