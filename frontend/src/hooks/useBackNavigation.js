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
    // System Console에서 진입한 경우 → 더보기 메뉴가 있는 dashboard로 이동하되
    // showMoreMenu 상태를 restore하기 어려우므로, dashboard로 이동하는 대신
    // navigate(-1)로 히스토리를 되돌리면 System Console overlay가 없어서
    // 결국 더보기 열기 전 상태로 돌아감.
    // 따라서 from: 'system-console' 일 때는 navigate(-1)을 사용하되,
    // 히스토리가 없을 경우(System Console이 없었을 경우) fallbackPath로 이동.
    const fromConsole = location.state?.from === 'system-console';

    if (fromConsole) {
      // navigate(-1)은 System Console(overlay) 이전 페이지(dashboard)로 가게 됨.
      // 대신 dashboard로 replace 없이 이동 + showMoreMenu를 state로 전달
      navigate('/dashboard', { state: { openMoreMenu: true } });
    } else {
      // 일반 뒤로가기
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallbackPath);
      }
    }
  }, [navigate, location.state, fallbackPath]);

  return goBack;
}
