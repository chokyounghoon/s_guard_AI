import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * useBackNavigation
 * System Console(더보기 메뉴)에서 진입한 페이지에서
 * 뒤로가기 시 System Console로 돌아오도록 처리하는 훅
 */
export function useBackNavigation(fallbackPath = '/dashboard') {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback(() => {
    const fromConsole = location.state?.from === 'system-console' || sessionStorage.getItem('console_return_pending') === '1';

    if (fromConsole) {
      sessionStorage.removeItem('console_return_pending');
      navigate('/dashboard', { state: { openMoreMenu: true }, replace: true });
    } else {
      // 일반 뒤로가기
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackPath, { replace: true });
      }
    }
  }, [navigate, location.state, fallbackPath]);

  return goBack;
}
