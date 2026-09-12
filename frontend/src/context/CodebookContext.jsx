import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAccessToken } from '../lib/authStore';

// ── 기본 공통 코드북 (서버 미배포 / 500 에러 시에도 안전하게 UI 동작) ──
export const DEFAULT_CODEBOOK = [
  // 장애 처리 상태 (INCIDENT_STATUS)
  { id: 101, category: 'INCIDENT_STATUS', code: 'INC_001', name: '미처리', sort_order: 10, is_active: 1, description: '장애 처리 대기 중' },
  { id: 102, category: 'INCIDENT_STATUS', code: 'INC_002', name: '처리중', sort_order: 20, is_active: 1, description: '장애 처리 및 분석 진행 중' },
  { id: 103, category: 'INCIDENT_STATUS', code: 'INC_003', name: '처리완료', sort_order: 30, is_active: 1, description: '장애 처리 완료 및 종료' },

  // War-Room 단계별 상태 (WR_STATUS)
  { id: 201, category: 'WR_STATUS', code: 'WR_001', name: '개설완료', sort_order: 10, is_active: 1, description: 'War-Room 실시간 채널 개설 완료' },
  { id: 202, category: 'WR_STATUS', code: 'WR_002', name: '분석중', sort_order: 20, is_active: 1, description: '실시간 대화 및 분석 진행 중' },
  { id: 203, category: 'WR_STATUS', code: 'WR_003', name: '대화분석완료', sort_order: 30, is_active: 1, description: '대화 내용 요약 및 분석 완료' },
  { id: 204, category: 'WR_STATUS', code: 'WR_004', name: '보고서작성완료', sort_order: 40, is_active: 1, description: 'AI 분석 리포트 생성 및 발행 완료' },
  { id: 205, category: 'WR_STATUS', code: 'WR_005', name: '최종처리완료', sort_order: 50, is_active: 1, description: '인시던트 최종 클로징 및 처리 완료' },

  // 시스템 권한/역할 (SYSTEM_ROLE)
  { id: 301, category: 'SYSTEM_ROLE', code: 'SUPER_ADMIN', name: '슈퍼 관리자', sort_order: 0, is_active: 1, description: '시스템 전체 제어 및 역할 관리 최고 권한' },
  { id: 302, category: 'SYSTEM_ROLE', code: 'ADMIN', name: '시스템 관리자', sort_order: 1, is_active: 1, description: '모든 기능에 대한 전체 권한' },
  { id: 303, category: 'SYSTEM_ROLE', code: 'ANALYST', name: '분석가', sort_order: 2, is_active: 1, description: '데이터 분석 및 보고서 작성 권한' },
  { id: 304, category: 'SYSTEM_ROLE', code: 'VIEWER', name: '조회자', sort_order: 3, is_active: 1, description: '단순 데이터 조회 및 모니터링 권한' },

  // 표준 직급 (POSITION)
  { id: 401, category: 'POSITION', code: 'POS_001', name: '팀원', sort_order: 1, is_active: 1, description: '팀원' },
  { id: 402, category: 'POSITION', code: 'POS_002', name: '파트장', sort_order: 2, is_active: 1, description: '파트장' },
  { id: 403, category: 'POSITION', code: 'POS_003', name: '팀장', sort_order: 3, is_active: 1, description: '팀장' },
  { id: 404, category: 'POSITION', code: 'POS_004', name: '본부장', sort_order: 4, is_active: 1, description: '본부장' },
  { id: 405, category: 'POSITION', code: 'POS_005', name: '상무', sort_order: 5, is_active: 1, description: '상무' },
  { id: 406, category: 'POSITION', code: 'POS_006', name: '부사장', sort_order: 6, is_active: 1, description: '부사장' },
  { id: 407, category: 'POSITION', code: 'POS_007', name: '사장', sort_order: 7, is_active: 1, description: '사장' },

  // 신한 계열사 (COMPANY)
  { id: 501, category: 'COMPANY', code: 'COM_001', name: '신한DS', sort_order: 0, is_active: 1, description: '신한DS' },
  { id: 502, category: 'COMPANY', code: 'COM_002', name: '신한금융지주', sort_order: 10, is_active: 1, description: '신한금융지주' },
  { id: 503, category: 'COMPANY', code: 'COM_003', name: '신한은행', sort_order: 20, is_active: 1, description: '신한은행' },
  { id: 504, category: 'COMPANY', code: 'COM_004', name: '신한카드', sort_order: 30, is_active: 1, description: '신한카드' },
  { id: 505, category: 'COMPANY', code: 'COM_005', name: '신한투자증권', sort_order: 40, is_active: 1, description: '신한투자증권' },
  { id: 506, category: 'COMPANY', code: 'COM_006', name: '신한라이프', sort_order: 50, is_active: 1, description: '신한라이프' },
  { id: 507, category: 'COMPANY', code: 'COM_007', name: '신한캐피탈', sort_order: 60, is_active: 1, description: '신한캐피탈' },
  { id: 508, category: 'COMPANY', code: 'COM_008', name: '신한자산운용', sort_order: 70, is_active: 1, description: '신한자산운용' },
  { id: 509, category: 'COMPANY', code: 'COM_009', name: '신한저축은행', sort_order: 80, is_active: 1, description: '신한저축은행' },
  { id: 510, category: 'COMPANY', code: 'COM_010', name: '신한AI', sort_order: 90, is_active: 1, description: '신한AI' },
  { id: 511, category: 'COMPANY', code: 'COM_011', name: '제주은행', sort_order: 100, is_active: 1, description: '제주은행' },
  { id: 512, category: 'COMPANY', code: 'COM_012', name: '신한벤처투자', sort_order: 110, is_active: 1, description: '신한벤처투자' },
  { id: 513, category: 'COMPANY', code: 'COM_013', name: '신한리츠운용', sort_order: 120, is_active: 1, description: '신한리츠운용' },
  { id: 514, category: 'COMPANY', code: 'COM_014', name: '신한대체투자운용', sort_order: 130, is_active: 1, description: '신한대체투자운용' },
  { id: 515, category: 'COMPANY', code: 'COM_015', name: '신한자산신탁', sort_order: 140, is_active: 1, description: '신한자산신탁' },
  { id: 516, category: 'COMPANY', code: 'COM_016', name: '신한펀드파트너스', sort_order: 150, is_active: 1, description: '신한펀드파트너스' },
  { id: 517, category: 'COMPANY', code: 'COM_017', name: '신한금융플러스', sort_order: 160, is_active: 1, description: '신한금융플러스' },
  { id: 518, category: 'COMPANY', code: 'COM_018', name: '신한큐브리스크컨설팅', sort_order: 170, is_active: 1, description: '신한큐브리스크컨설팅' }
];

const groupCodesByCategory = (rawCodes) => {
  return (rawCodes || []).reduce((acc, code) => {
    if (!acc[code.category]) {
      acc[code.category] = [];
    }
    acc[code.category].push(code);
    return acc;
  }, {});
};

const CodebookContext = createContext();

export const useCodebook = () => {
  const context = useContext(CodebookContext);
  if (!context) {
    throw new Error('useCodebook must be used within a CodebookProvider');
  }
  return context;
};

export const CodebookProvider = ({ children }) => {
  // 초기 상태를 기본 코드북으로 즉시 설정하여 UI 렌더링 지연/깜빡임 및 실패 방지
  const [codes, setCodes] = useState(() => groupCodesByCategory(DEFAULT_CODEBOOK));
  const [allCodes, setAllCodes] = useState(DEFAULT_CODEBOOK);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  const fetchCodes = useCallback(async () => {
    const token = getAccessToken();
    // 🚫 Don't fetch without auth — prevents 401 on codebook endpoint
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sms/codebook`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        // 서버 응답이 500 등이더라도 기본 코드북이 활성화되어 있으므로 경고만 기록
        console.warn(`[Codebook] Remote fetch responded with HTTP ${response.status}. Using default system codebook.`);
        setError(`Remote codebook status: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const rawCodes = data.codes || [];
      if (Array.isArray(rawCodes) && rawCodes.length > 0) {
        setAllCodes(rawCodes);
        setCodes(groupCodesByCategory(rawCodes));
      }
      setError(null);
    } catch (err) {
      console.warn('[Codebook] Remote fetch failed, falling back to default codebook:', err.message);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      fetchCodes();
    } else {
      setIsLoading(false);
    }
  }, [fetchCodes]);

  const getCodesByCategory = useCallback((category) => {
    return codes[category] || [];
  }, [codes]);

  const getCodeName = useCallback((category, code, fallback = null) => {
    if (!code) return fallback ?? '';
    const norm = String(code).toUpperCase().trim();
    const catList = codes[category] || [];
    const found = catList.find(c => 
      String(c.code).toUpperCase().trim() === norm || 
      String(c.name).toUpperCase().trim() === norm
    );
    return found ? found.name : (fallback ?? code);
  }, [codes]);

  const value = {
    codes,
    allCodes,
    isLoading,
    error,
    getCodesByCategory,
    getCodeName,
    refreshCodes: fetchCodes
  };

  return (
    <CodebookContext.Provider value={value}>
      {children}
    </CodebookContext.Provider>
  );
};

