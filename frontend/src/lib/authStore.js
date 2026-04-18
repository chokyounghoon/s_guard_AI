/**
 * 🛡️ Auth Store
 * access_token과 userProfile을 메모리에 안전하게 보관하고,
 * 쿠키 차단을 우회하기 위한 Ghost Token(localStorage 리프레시 토큰)을 관리합니다.
 */

let accessToken = null;
let userProfile = null;
const listeners = new Set();

const notify = () => {
  listeners.forEach(listener => listener({ accessToken, userProfile }));
};

export const setAccessToken = (token) => {
  accessToken = token;
  notify();
};

export const getAccessToken = () => {
  return accessToken;
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
  return userProfile;
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
  localStorage.removeItem('sguard_user');
  localStorage.removeItem('sguard_ghost');
  notify();
};

export const addAuthListener = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
