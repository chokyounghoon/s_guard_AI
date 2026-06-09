import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, Share2, Sparkles, AlertCircle, MessageSquare,
  FileText, Paperclip, Clock, Users, CheckCircle2, Send, User, Check, ChevronRight, X,
  Database, Shield, Server, Bot, Activity, RefreshCw, Loader, Zap,
  Search, Filter, Calendar, Building2, AlertTriangle, CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { getAuthHeaders } from '../lib/authStore';
import { SMS_WORKER_URL } from '../config/api';

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const tz = end.getTimezoneOffset() * 60000;
  return {
    startDate: new Date(start.getTime() - tz).toISOString().split('T')[0],
    endDate:   new Date(end.getTime()   - tz).toISOString().split('T')[0],
  };
};

const API_BASE_URL = 'https://sguardai.khcho0421.workers.dev';

const mdComponents = {
  h1: ({ children }) => (
    <div style={{ margin: '28px 0 12px', paddingBottom: 10, borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
      <h1 style={{ fontSize: 17, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.01em', lineHeight: 1.3, margin: 0 }}>
        {children}
      </h1>
    </div>
  ),
  h2: ({ children }) => (
    <div style={{ margin: '22px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg,#3b82f6,#6366f1)', flexShrink: 0 }} />
      <h2 style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
        {children}
      </h2>
    </div>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: '16px 0 6px', paddingLeft: 8, borderLeft: '2px solid rgba(99,102,241,0.5)' }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <div className="md-p" style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.8, marginBottom: 10, wordBreak: 'break-word' }}>
      {children}
    </div>
  ),
  strong: ({ children }) => (
    <strong style={{ color: '#93c5fd', fontWeight: 800, background: 'linear-gradient(90deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(59,130,246,0.3)', padding: '2px 8px', borderRadius: 6, display: 'inline-block', marginRight: 6, marginBottom: 2 }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: '#94a3b8', fontStyle: 'italic' }}>{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      margin: '12px 0', padding: '10px 14px',
      background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid #3b82f6',
      borderRadius: '0 8px 8px 0', color: '#94a3b8', fontSize: 13,
    }}>
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) => inline
    ? <code style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', fontSize: 11.5, padding: '2px 6px', borderRadius: 5, fontFamily: 'monospace', border: '1px solid rgba(16,185,129,0.2)' }}>{children}</code>
    : (
      <pre style={{ background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', margin: '12px 0', overflowX: 'auto', fontSize: 11.5, color: '#6ee7b7', fontFamily: 'monospace', lineHeight: 1.7 }}>
        <code>{children}</code>
      </pre>
    ),
  ul: ({ children }) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyleType: 'decimal', paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.7 }}>
      <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, display: 'inline-block' }} />
      <div style={{ flex: 1, wordBreak: 'break-word' }}>{children}</div>
    </li>
  ),
  hr: () => (
    <div style={{ margin: '20px 0', height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)' }} />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, wordBreak: 'keep-all' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ background: 'rgba(30,41,59,0.9)', borderBottom: '2px solid rgba(59,130,246,0.3)' }}>{children}</thead>,
  th: ({ children }) => (
    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, color: '#93c5fd', fontSize: 11.5, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 100 }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ padding: '12px 16px', color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top', wordBreak: 'break-word' }}>
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(59,130,246,0.06)'} onMouseLeave={e => e.currentTarget.style.background=''}>
      {children}
    </tr>
  ),
};

function MarkdownBlock({ text, report, checkedItems = {}, onToggleCheck = () => {} }) {
  if (!text) return <span style={{ color: '#475569' }}>-</span>;
  
  let clean = text;

  // 1. 역피라미드 정렬: [S-Autopilot Insight], [전문가별 심층 진단], [리더의 최종 조치 가이드] 섹션 순서 보장
  const sInsightMatch = clean.match(/(?:\[S-Autopilot Insight\]|### 💡 S-Autopilot Insight)([\s\S]*?)(?=(?:\[전문가별|\[리더의|### 🛡️|### 🎯|$))/i);
  const sExpertMatch  = clean.match(/(?:\[전문가별 심층 진단\]|### 🛡️ 전문가별 심층 진단)([\s\S]*?)(?=(?:\[S-Autopilot|\[리더의|### 💡|### 🎯|$))/i);
  const sGuideMatch   = clean.match(/(?:\[리더의 최종 조치 가이드\]|### 🎯 리더의 최종 조치 가이드)([\s\S]*?)(?=(?:\[S-Autopilot|\[전문가별|### 💡|### 🛡️|$))/i);

  if (sInsightMatch || sExpertMatch || sGuideMatch) {
    let reordered = '';
    if (sInsightMatch) reordered += `### 💡 S-Autopilot Insight\n\n${sInsightMatch[1].trim()}\n\n`;
    if (sExpertMatch)  reordered += `### 🛡️ 전문가별 심층 진단 (원인 특정)\n\n${sExpertMatch[1].trim()}\n\n`;
    if (sGuideMatch)   reordered += `### 🎯 리더의 최종 조치 가이드 (긴급 작전 체크리스트)\n\n${sGuideMatch[1].trim()}\n\n`;
    clean = reordered || clean;
  } else {
    clean = clean
      .replace(/(?:^|\s|\n)\[S-Autopilot Insight\]/gi, '\n\n### 💡 S-Autopilot Insight\n\n')
      .replace(/(?:^|\s|\n)\[전문가별 심층 진단\]/gi, '\n\n### 🛡️ 전문가별 심층 진단 (원인 특정)\n\n')
      .replace(/(?:^|\s|\n)\[리더의 최종 조치 가이드\]/gi, '\n\n### 🎯 리더의 최종 조치 가이드 (긴급 작전 체크리스트)\n\n');
  }

  // 2. 문자열 내의 기존 마크다운 별표(*) 및 불필요한 대시(-) 기호 정리
  clean = clean.replace(/\*/g, '').replace(/^-+\s*/gm, '');

  // 3. 주요 키워드들을 감지하여 단 한 번씩만 불릿 문단으로 변환
  const keywords = [
    '상황 요약', '상황요약', '담당자 자동 할당', '담당자 자동할당', '핵심 분석 방향', '분석 방향',
    'Security Agent', 'DB Agent', 'DevOps Agent', 'Leader Agent', 'Network Agent',
    '원인 특정', '조치 권고', '담당자 할당', '분석 결과', '장애 원인', '해결 방안', '조치 가이드'
  ].join('|');

  const keywordRegex = new RegExp(`(?:\\s*)(${keywords})\\s*:`, 'gi');
  clean = clean.replace(keywordRegex, '\n\n- **$1:** ');

  // 4. 조치 가이드 내의 항목들을 작전판 체크리스트 기호('[ ]')로 자동 변환
  clean = clean.replace(/-\s+(조치 사항|긴급 조치|향후 권고|상황 전파|대외 기관|EAS 서버|'신분증)/gi, '- [ ] $1');

  // 5. 과도한 빈 줄 및 중복 개행 정리
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();

  // 6. 담당자 사번 발견 시 옆에 사원명 자동 삽입
  if (report?.who) {
    const assigneeName = report.who_name || report.creator_name;
    if (assigneeName && !clean.includes(assigneeName)) {
      const regex = new RegExp(`(${report.who})`, 'g');
      clean = clean.replace(regex, `$1 (${assigneeName})`);
    }
  }

  const customComponents = useMemo(() => ({
    ...mdComponents,
    li: ({ children }) => {
      let textStr = '';
      React.Children.forEach(children, child => {
        if (typeof child === 'string') textStr += child;
        else if (child?.props?.children && typeof child.props.children === 'string') textStr += child.props.children;
      });
      
      const isCheckItem = textStr.trim().startsWith('[ ]') || textStr.trim().startsWith('[x]') || textStr.trim().startsWith('[X]');
      
      if (isCheckItem) {
        const cleanText = textStr.replace(/^\[[ xX]?\]/, '').trim();
        const isChecked = checkedItems[cleanText] || textStr.trim().startsWith('[x]') || textStr.trim().startsWith('[X]');
        return (
          <li 
            onClick={(e) => { e.stopPropagation(); onToggleCheck(cleanText); }}
            className={`flex items-start gap-3 p-3.5 my-2.5 rounded-2xl border transition-all cursor-pointer select-none shadow-lg text-left ${
              isChecked 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-400 line-through' 
                : 'bg-[#161b2a] border-blue-500/30 hover:border-blue-500 text-slate-100 font-bold'
            }`}
          >
            <div className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
              isChecked ? 'bg-emerald-500 border-emerald-400 text-black' : 'border-slate-500 bg-black/40 text-transparent'
            }`}>
              <Check size={14} className="stroke-[3]" />
            </div>
            <div className="flex-1 text-xs leading-relaxed break-words">{cleanText}</div>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-black uppercase shrink-0 ${isChecked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
              {isChecked ? 'Done' : 'Action'}
            </span>
          </li>
        );
      }
      
      return (
        <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.7 }}>
          <span style={{ marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, display: 'inline-block' }} />
          <div style={{ flex: 1, wordBreak: 'break-word' }}>{children}</div>
        </li>
      );
    }
  }), [checkedItems, onToggleCheck]);

  return (
    <div className="markdown-body-custom" style={{ fontSize: 13.5, lineHeight: 1.8, wordBreak: 'break-word' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>{clean}</ReactMarkdown>
    </div>
  );
}


const severityColors = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  NORMAL:   'bg-blue-500/20 text-blue-400 border-blue-500/40',
  INFO:     'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const agentColors = {
  Security: { bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-400', icon: Shield },
  DB:       { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', icon: Database },
  DevOps:   { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400', icon: Server },
  Leader:   { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: Bot },
};

const getStatusName = (status) => {
  if (!status) return '미확인';
  const s = String(status).toUpperCase();
  if (s === 'INC_001') return '미확인';
  if (s === 'INC_002') return '분석중';
  if (s === 'INC_003') return '처리완료';
  return status;
};

export default function AiReportPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const location = useLocation();
  const params = useParams();
  
  const rawId = params.incidentId || location.state?.incidentId;
  const incidentId = rawId ? String(rawId).replace("INC-", "").trim() : null;
  const currentUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');

  // — 검색 목록 모드 state (항상 선언 — Hook 규칙) —
  // — 검색 목록 모드 state (항상 선언 — Hook 규칙) —
  const listMode = !incidentId;
  const dates = useMemo(() => getDefaultDates(), []);
  const [srchParams, setSrchParams] = useState({
    incidentId: '', keyword: '',
    startDate: dates.startDate, endDate: dates.endDate,
    severity: '', status: '처리완료', assignee: ''
  });
  const [allUsers, setAllUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [srchLoading, setSrchLoading] = useState(false);
  const [srchStats, setSrchStats] = useState({ total: 0, critical: 0, high: 0, normal: 0 });
  const [didSearch, setDidSearch] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // — 상세 보기 state (항상 선언 — Hook 규칙) —
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(!!incidentId);
  const [error, setError] = useState('');
  const [memo, setMemo] = useState('');
  const [modalStep, setModalStep] = useState(null);
  const [selectedLines, setSelectedLines] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [aiGenText, setAiGenText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const genAbortRef = useRef(null);
  const [chatSummary, setChatSummary] = useState('');

  const isTestIncident = useMemo(() => {
    if (!report) return false;
    const testKeywords = /테스트|test|TEST|샘플|sample|demo|데모/i;
    return testKeywords.test(
      [incidentId, report.title, report.message, chatSummary, aiGenText].filter(Boolean).join(' ')
    );
  }, [incidentId, report, chatSummary, aiGenText]);

  const formatTimeline = (text) => {
    if (!text) return '';
    // [HH:MM:SS] 패턴을 마크다운 글머리 기호와 굵은 글씨로 변환하여 타임라인 형태로 표시
    return text.replace(/(?:\s*)(\[\d{2}:\d{2}:\d{2}\])/g, '\n\n- **$1**').trim();
  };
  const [checkedActionItems, setCheckedActionItems] = useState({});
  const toggleActionItem = useCallback((key) => {
    setCheckedActionItems(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // 🚀 탭 목록 및 제스처 스와이프 연동
  const tabs = useMemo(() => [
    { id: 'summary',   label: 'AI 분석 요약' },
    { id: 'agents',    label: 'Agent 로그' },
    { id: 'chat',      label: 'War-Room 요약' },
    { id: 'files',     label: '첨부파일' },
    { id: 'ai_report', label: '✨ AI 종합보고서' },
  ], []);

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    // changedTouches가 없을 수도 있음 (touchcancel 등)
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    if (!touch) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }

    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const dx = touchStartX.current - touchEndX;
    const dy = touchStartY.current - touchEndY;

    // 더 관대한 스와이프 조건: X 이동이 40px 이상이고, Y 이동보다 크면 스와이프 인정
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      const currentIndex = tabs.findIndex(t => t.id === activeTab);
      if (currentIndex === -1) return;

      if (dx > 0 && currentIndex < tabs.length - 1) {
        // 좌측으로 스와이프 (다음 탭)
        if (navigator.vibrate) navigator.vibrate(20);
        const nextId = tabs[currentIndex + 1].id;
        setActiveTab(nextId);
        const el = document.getElementById(`tab-${nextId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else if (dx < 0 && currentIndex > 0) {
        // 우측으로 스와이프 (이전 탭)
        if (navigator.vibrate) navigator.vibrate(20);
        const prevId = tabs[currentIndex - 1].id;
        setActiveTab(prevId);
        const el = document.getElementById(`tab-${prevId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // 🚀 탭 바 가로 스크롤 인디케이터 상태
  const tabsRef = useRef(null);
  const [hasMoreTabs, setHasMoreTabs] = useState(false);

  const checkTabsScroll = () => {
    if (!tabsRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
    setHasMoreTabs(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    if (report && !listMode) {
      setTimeout(checkTabsScroll, 100);
      window.addEventListener('resize', checkTabsScroll);
      return () => window.removeEventListener('resize', checkTabsScroll);
    }
  }, [report, listMode, activeTab]);

  // 사용자 목록 로드
  useEffect(() => {
    if (!listMode) return;
    fetch(`${SMS_WORKER_URL}/users`, { headers: getAuthHeaders() })
      .then(r => r.json()).then(setAllUsers).catch(() => {});
  }, [listMode]);

  const handleListSearch = useCallback(async (overrideParams) => {
    setSrchLoading(true);
    const p = overrideParams || srchParams;
    const qs = new URLSearchParams();
    if (p.incidentId) qs.append('inc_id', p.incidentId);
    if (p.keyword)    qs.append('keyword', p.keyword);
    if (p.startDate)  qs.append('startDate', p.startDate);
    if (p.endDate)    qs.append('endDate', p.endDate);
    if (p.severity)   qs.append('severity', p.severity);
    if (p.status)     qs.append('status', p.status);
    if (p.assignee)   qs.append('assignee', p.assignee);
    try {
      const res = await fetch(`${SMS_WORKER_URL}/incidents?${qs.toString()}`, { headers: getAuthHeaders() });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.incidents || []);
      setSearchResults(list);
      setSrchStats({
        total: list.length,
        critical: list.filter(i => i.severity === 'CRITICAL').length,
        high: list.filter(i => i.severity === 'HIGH' || i.severity === 'MAJOR').length,
        normal: list.filter(i => !['CRITICAL','HIGH','MAJOR'].includes(i.severity)).length,
      });
      setDidSearch(true);
    } catch (e) {
      console.warn('search failed', e);
    } finally {
      setSrchLoading(false);
    }
  }, [srchParams]);

  // 실시간 라이브 디바운스 검색 (키워드/조건 변경 시 자동조회)
  useEffect(() => {
    if (!listMode) return;
    const timer = setTimeout(() => {
      handleListSearch();
    }, 250);
    return () => clearTimeout(timer);
  }, [srchParams.keyword, srchParams.incidentId, srchParams.startDate, srchParams.endDate, srchParams.severity, srchParams.status, srchParams.assignee, listMode, handleListSearch]);

  const handleQuickDate = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const tz = end.getTimezoneOffset() * 60000;
    const p = {
      ...srchParams,
      startDate: new Date(start.getTime() - tz).toISOString().split('T')[0],
      endDate:   new Date(end.getTime()   - tz).toISOString().split('T')[0],
    };
    setSrchParams(p);
  };

  const sevCls = { CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30', HIGH: 'text-orange-400 bg-orange-500/10 border-orange-500/30', NORMAL: 'text-blue-400 bg-blue-500/10 border-blue-500/20', INFO: 'text-slate-400 bg-slate-500/10 border-slate-500/20', MAJOR: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };

  // — 상세 보기용 useEffect들을 조건부 return 앞에 선언 (Hook 규칙) —
  useEffect(() => () => { if (genAbortRef.current) genAbortRef.current.abort(); }, []);

  useEffect(() => {
    if (!incidentId) return;
    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/warroom/report/${incidentId}`, {
          headers: getAuthHeaders()
        });
        if (res.status === 404) throw new Error('NOT_FOUND');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setReport(data);
      } catch (e) {
        if (e.message === 'NOT_FOUND') {
          setError('아직 보고서 생성 전입니다.');
        } else {
          setError(`데이터 로드 실패: ${e.message}`);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReport();

    const fetchSummary = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/db/summary/${incidentId}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.summary) setChatSummary(data.summary);
        }
      } catch (e) {
        console.warn('Summary fetch failed:', e);
      }
    };
    fetchSummary();
  }, [incidentId]);

  useEffect(() => {
    if (activeTab === 'ai_report' && !aiGenText && !isGenerating && report) {
      generateAiReport();
    }
  }, [activeTab, aiGenText, isGenerating, report]);

  if (listMode) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0d14] text-white font-sans flex flex-col pb-24 select-none overflow-y-auto">
        {/* ── Sticky Header (Slim 1-line + Quick Search) ───────────── */}
        <header className="sticky top-0 z-50 bg-[#0a0d14]/95 backdrop-blur-xl border-b border-white/5 flex flex-col gap-2.5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button onClick={() => goBack()} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
              <div>
                <h1 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-400" /> AI 장애 보고서
                </h1>
                <p className="text-[10px] text-slate-500 font-mono">
                  {srchParams.startDate.substring(2).replace(/-/g, '.')} ~ {srchParams.endDate.substring(2).replace(/-/g, '.')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFilterSheet(true)}
              className="skeuo-btn flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 border border-blue-500/40 rounded-xl text-xs font-black text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)] active:scale-95 transition-all cursor-pointer"
            >
              <Filter size={14} />
              <span>상세 필터</span>
              {(srchParams.keyword || srchParams.incidentId || srchParams.assignee) && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />}
            </button>
          </div>

          {/* 빠른 키워드 검색 바 */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-blue-500/50 transition-colors">
            <Search size={14} className="text-slate-400 mr-2 shrink-0" />
            <input
              type="text" placeholder="제목 · ID · 메시지 빠른 검색"
              value={srchParams.keyword}
              onChange={e => { const v = e.target.value; setSrchParams(p => ({ ...p, keyword: v })); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleListSearch(); } }}
              className="w-full bg-transparent py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {srchParams.keyword && (
              <button onClick={() => { setSrchParams(p => ({ ...p, keyword: '' })); }} className="p-1 hover:opacity-80">
                <X size={12} className="text-slate-400" />
              </button>
            )}
          </div>
        </header>

        {/* ── Sticky 요약 카드 (Summary Cards - 필터링 연동) ──────────────────────── */}
        <div className="sticky top-[102px] z-40 bg-[#0a0d14]/90 backdrop-blur-md px-4 py-3 border-b border-white/5 shadow-lg">
          <div className="grid grid-cols-3 gap-2.5 max-w-5xl mx-auto">
            {[{label:'전체 장애', val:'', count:srchStats.total, color:'blue', border:'border-blue-500/30', bg:'bg-blue-500/5'},
              {label:'CRITICAL', val:'CRITICAL', count:srchStats.critical, color:'red', border:'border-red-500/40', bg:'bg-red-500/5'},
              {label:'HIGH / MAJOR', val:'HIGH', count:srchStats.high, color:'orange', border:'border-orange-500/40', bg:'bg-orange-500/5'}].map(s => {
              const active = srchParams.severity === s.val;
              return (
                <button
                  key={s.label}
                  onClick={() => setSrchParams(p => ({ ...p, severity: s.val }))}
                  className={`border rounded-xl p-2.5 text-center flex flex-col justify-center transition-all cursor-pointer select-none active:scale-95 ${active ? `border-${s.color}-400 bg-${s.color}-500/20 shadow-[0_0_15px_rgba(${s.color === 'red' ? '239,68,68': s.color === 'orange' ? '249,115,22' : '59,130,246'},0.3)]` : `${s.bg} ${s.border} opacity-70 hover:opacity-100`}`}
                >
                  <p className={`text-xl font-black text-${s.color}-400 font-mono leading-none`}>{s.count}</p>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-1">{s.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 결과 리스트 (Color Coding 정교화 + 선택된 요약 카드 필터 연동) ──────────────────────── */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4 space-y-3.5">
          {srchLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <span className="text-sm font-bold">장애 이력 실시간 필터링 중...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white/5 border border-white/10 rounded-2xl text-center my-4">
              <FileText size={36} className="text-slate-600 mb-3" />
              <p className="text-sm font-black text-slate-300 mb-1">검색 결과가 없습니다</p>
              <p className="text-xs text-slate-500">상단 필터 버튼을 눌러 조건을 변경해 보세요</p>
            </div>
          ) : (() => {
            const displayList = searchResults.filter(inc => {
              if (!srchParams.severity) return true;
              const s = (inc.severity || 'NORMAL').toUpperCase();
              if (srchParams.severity === 'HIGH') return s === 'HIGH' || s === 'MAJOR';
              return s === srchParams.severity;
            });

            if (displayList.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16 bg-white/5 border border-white/10 rounded-2xl text-center my-4">
                  <AlertCircle size={36} className="text-slate-600 mb-3" />
                  <p className="text-sm font-black text-slate-300 mb-1">선택된 심각도에 해당하는 장애가 없습니다</p>
                  <button onClick={() => setSrchParams(p => ({ ...p, severity: '' }))} className="text-xs text-blue-400 mt-2 underline cursor-pointer">전체 장애 보기</button>
                </div>
              );
            }

            return (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs font-bold text-slate-400">조회된 장애 <strong className="text-blue-400">{displayList.length}</strong>건</span>
                  <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2.5 py-1 rounded-full border border-white/10">최신 발생순</span>
                </div>
                {displayList.map(inc => {
                  const sev = (inc.severity || 'NORMAL').toUpperCase();
                  const sc = sev === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                             sev === 'HIGH' || sev === 'MAJOR' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                             sev === 'NORMAL' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-500/20 text-slate-400 border-slate-500/40';
                  
                  const st = String(inc.status || '').toUpperCase();
                  const isComplete = st.includes('완료') || st.includes('COMPLETED') || st === 'INC_003' || st === 'CLOSED' || st === '정상';
                  const isProgress = st.includes('분석중') || st.includes('처리중') || st.includes('PROGRESS') || st === 'INC_002';
                  
                  const statusCls = isComplete ? 'bg-slate-500/10 border-slate-500/20 text-slate-400 font-normal' :
                                    isProgress ? 'bg-[#ff8800]/15 border-[#ff8800]/40 text-[#ff8800] font-black animate-pulse shadow-[0_0_10px_rgba(255,136,0,0.2)]' :
                                    'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold';
                  const statusName = isComplete ? '처리완료' : isProgress ? '분석중' : getStatusName(inc.status);
                  const assignee = inc.assignee_name || inc.assigned_to || '-';

                  return (
                    <div
                      key={inc.inc_id}
                      onClick={() => navigate(`/ai-report/${inc.inc_id}`)}
                      className="skeuo-card p-4 rounded-2xl bg-[#12151a] hover:bg-[#1a1f26] border border-white/10 transition-all duration-300 flex flex-col gap-2.5 cursor-pointer relative overflow-hidden shadow-xl active:scale-[0.98] group"
                    >
                      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: sev === 'CRITICAL' ? '#ff2a2a' : sev === 'HIGH' || sev === 'MAJOR' ? '#ffb700' : '#3b82f6' }} />
                      
                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wide ${sc}`}>{sev}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${statusCls}`}>{statusName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{inc.created_at?.slice(0, 16) || '-'}</span>
                      </div>

                      <div className="pl-2 pr-1">
                        <h3 className="text-sm font-black text-white leading-snug break-words line-clamp-3 group-hover:text-blue-400 transition-colors">
                          {(inc.title || '').replace(/^INC-[\w-]+\s*\|\s*/i, '') || `INC-${inc.inc_id}`}
                        </h3>
                        {inc.message && (
                          <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 font-normal leading-relaxed">{inc.message}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 pl-2 mt-1">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-mono tracking-tighter truncate max-w-[140px]">INC-{inc.inc_id}</span>
                          {assignee !== '-' && <span className="text-[10px] text-blue-400 font-bold">담당: {assignee}</span>}
                        </div>
                        <div className="flex items-center gap-0.5 text-[11px] font-bold text-blue-400 group-hover:translate-x-1 transition-transform shrink-0">
                          <span>보고서 보기</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </main>

        {/* ── Bottom Sheet Modal (상세 검색 필터) ────────────────── */}
        {showFilterSheet && (
          <div className="fixed inset-0 z-[150] flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowFilterSheet(false)}>
            <div className="bg-[#12151a] border-t border-white/10 rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto select-none" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-1" />
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-400" /> 상세 검색 필터
                </h2>
                <button onClick={() => setShowFilterSheet(false)} className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-4 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">장애 ID</label>
                    <input
                      type="text" placeholder="INC-번호 입력"
                      value={srchParams.incidentId}
                      onChange={e => setSrchParams(p => ({ ...p, incidentId: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">처리자</label>
                    <select
                      value={srchParams.assignee}
                      onChange={e => setSrchParams(p => ({ ...p, assignee: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">전체 담당자</option>
                      {allUsers.map(u => <option key={u.employee_id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" /> 조회 기간
                    </label>
                    <div className="flex gap-1">
                      {[[1,'오늘'],[7,'7일'],[30,'30일'],[90,'90일']].map(([d,l]) => (
                        <button key={d} type="button" onClick={() => handleQuickDate(d)}
                          className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={srchParams.startDate} onChange={e => setSrchParams(p => ({...p, startDate: e.target.value}))} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" style={{colorScheme:'dark'}} />
                    <input type="date" value={srchParams.endDate} onChange={e => setSrchParams(p => ({...p, endDate: e.target.value}))} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" style={{colorScheme:'dark'}} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">심각도</label>
                    <select value={srchParams.severity} onChange={e => setSrchParams(p => ({...p, severity: e.target.value}))} className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50">
                      <option value="">전체</option>
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH / MAJOR</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="INFO">INFO</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">처리 상태</label>
                    <select value={srchParams.status} onChange={e => setSrchParams(p => ({...p, status: e.target.value}))} className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500/50">
                      <option value="">전체</option>
                      <option value="처리완료">처리완료</option>
                      <option value="처리중">처리중 / 분석중</option>
                      <option value="대기">대기</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/10 mt-2">
                <button onClick={() => { const p = { incidentId:'', keyword:'', ...getDefaultDates(), severity:'', status:'처리완료', assignee:'' }; setSrchParams(p); }} className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer">
                  초기화
                </button>
                <button onClick={() => { handleListSearch(); setShowFilterSheet(false); }} className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-blue-400 text-black font-black text-sm rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer">
                  <Search size={16} />적용 및 조회하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // — 기존 보고서 상세 보기 —

  const generateAiReport = async () => {
    if (!incidentId) return;
    if (genAbortRef.current) genAbortRef.current.abort();
    const controller = new AbortController();
    genAbortRef.current = controller;
    setAiGenText('');
    setIsGenerating(true);
    setActiveTab('ai_report');
    try {
      const safeId = String(incidentId);
      const reqId = safeId;
      const res = await fetch(`${API_BASE_URL}/ai/generate-report`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ incident_id: reqId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      const processBlock = (block) => {
        if (!block) return;
        const lines = block.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const d = line.slice(5).trim();
            if (d === '[DONE]') { setIsGenerating(false); return; }
            try {
              const obj = JSON.parse(d);
              if (obj.error) {
                setAiGenText(prev => prev + `\n\n⚠️ 서버 내부 오류 (스트림): ${obj.error}`);
              } else if (obj.answer) {
                setAiGenText(prev => prev + obj.answer);
              }
            } catch (e) {
              console.warn('Parse error:', e, d);
            }
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buf += decoder.decode(value || new Uint8Array(), { stream: !done });
        
        let newlineIdx;
        while ((newlineIdx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, newlineIdx).trim();
          buf = buf.slice(newlineIdx + 2);
          processBlock(block);
        }

        if (done) {
          if (buf.trim()) processBlock(buf.trim());
          break;
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setAiGenText(prev => prev + `\n\n⚠️ 생성 중 오류가 발생했습니다. (${e.message})`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const reportingLines = [
    { id: 'leader',   role: '팀장',  name: '직속 팀장', desc: '직속 상급자' },
    { id: 'director', role: '본부장', name: '부서 본부장', desc: '부서 책임자' },
    { id: 'exec',     role: '상무',  name: '사업부 상무', desc: '사업부 임원' },
  ];


  const toggleLine = (id) => {
    setSelectedLines(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleFinalSubmit = async () => {
    try {
      await fetch(`${API_BASE_URL}/ai/report/save`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          incident_id: incidentId,
          title: report?.title || incidentId,
          content: `[6W1H]\nWho: ${report?.who}\nWhen: ${report?.when}\nWhere: ${report?.where}\nWhat: ${report?.what}\nWhy: ${report?.why}\nHow: ${report?.how}\n\n[메모]\n${memo}`,
        }),
      });
      alert(`보고서가 전파되었으며 지식DB 학습이 시작되었습니다.`);
      navigate('/dashboard');
    } catch {
      alert('전송에 실패했습니다.');
    }
  };



  const sev = report?.severity || 'NORMAL';
  const sevClass = severityColors[sev] || severityColors.NORMAL;

  return (
    <div className="h-[100dvh] bg-[#0a0d14] text-white font-sans flex flex-col overflow-hidden">
      {/* Header — 2줄 풀-width */}
      <header className="sticky top-0 z-50 bg-[#0a0d14]/95 backdrop-blur-xl border-b border-white/5">
        {/* Row 1: 네비게이션 + 타이틀 */}
        <div className="max-w-5xl mx-auto w-full flex items-center gap-2 px-3 py-2">
          <button onClick={() => goBack()} className="shrink-0 p-2 rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>

          {/* 중앙 타이틀 영역: severity+ID 한 줄, 제목 별도 줄로 wrap */}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            {report ? (
              <>
                {/* Severity + ID */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${sevClass}`}>
                    {sev}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    INC-{incidentId}
                  </span>
                  {isTestIncident && (
                    <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/35 uppercase tracking-tighter animate-pulse">
                      TEST
                    </span>
                  )}
                  {report.similarity_score != null && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                      <Zap className="w-2.5 h-2.5 fill-blue-400/30" />
                      {Math.round(report.similarity_score * 100)}%
                    </span>
                  )}
                </div>
                {/* 제목: 풀텍스트, 줄바꿈 허용 */}
                <h1 className="font-bold text-sm text-slate-100 leading-snug break-words whitespace-normal">
                  {(report.title || '').replace(/^INC-[\w-]+\s*\|\s*/i, '')}
                </h1>
              </>
            ) : (
              <span className="text-sm text-slate-400">장애 보고서</span>
            )}
          </div>

          {/* 공유 버튼 + 툴팁 */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setShowShareTooltip(true);
                setTimeout(() => setShowShareTooltip(false), 2500);
              }}
              className="p-2 rounded-full hover:bg-white/5 transition-colors"
            >
              <Share2 className="w-5 h-5 text-slate-400" />
            </button>
            {showShareTooltip && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: 'rgba(15,18,32,0.97)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '10px 14px', minWidth: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 200,
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>공유 옵션</p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(window.location.href); setShowShareTooltip(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 8px', borderRadius: 8, border: 'none',
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 4,
                  }}
                >
                  🔗 링크 복사
                </button>
                <button
                  onClick={() => { window.print(); setShowShareTooltip(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 8px', borderRadius: 8, border: 'none',
                    background: 'rgba(255,255,255,0.05)', color: '#94a3b8',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  🖨️ 인쇄 / PDF 저장
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: 메타데이터 스와이프 칩 바 (대상 시스템 제거 및 극도로 간결한 미니 바 유지) */}
        {report && (
          <div className="bg-[#0d1220] border-t border-white/5 py-1.5 px-2 shadow-inner">
            <div className="relative max-w-5xl mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 py-1 pr-12 text-left">
                <span className="skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30 font-bold flex items-center gap-1.5 shadow-sm">
                  <Clock size={13} /> {report.created_at?.slice(5, 16) || '05-15 11:41'}
                </span>
                
                <span className="skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1.5 shadow-sm">
                  <Users size={13} /> {report.who_name || report.creator_name || (report.who && String(report.who).startsWith('S') ? '조경훈' : report.who) || '조경훈'}
                </span>

                <span className="skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-black bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1.5 shadow-sm">
                  <Activity size={13} /> MTTR {report.duration_label ?? (report.duration_min != null ? `${report.duration_min}분` : '51분')}
                </span>

                <span className="skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <MessageSquare size={13} /> 채팅 {report.message_count || 0}
                </span>

                <span className="skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
                  <Paperclip size={13} /> 첨부 {report.attachment_count || 0}
                </span>
              </div>

              {/* 우측 스와이프 시각적 인디케이터 */}
              <div className="absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-[#0d1220] via-[#0d1220]/80 to-transparent flex items-center justify-end pr-2 pointer-events-none z-10 animate-pulse">
                <div className="bg-white/10 text-slate-300 p-1 rounded-full border border-white/20 shadow-lg flex items-center justify-center">
                  <ChevronRight size={14} className="stroke-[3]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </header>


      {/* Tabs with Horizontal Scroll Indicator */}
      <div className="relative border-b border-white/5 bg-[#0a0d14] shrink-0">
        <div 
          ref={tabsRef}
          onScroll={checkTabsScroll}
          className="flex overflow-x-auto custom-scrollbar no-scrollbar max-w-5xl mx-auto"
        >
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id);
                const el = document.getElementById(`tab-${t.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
              id={`tab-${t.id}`}
              className={`px-5 py-3 text-[13px] font-bold whitespace-nowrap transition-all border-b-2 relative shrink-0 ${
                activeTab === t.id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
              {activeTab === t.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              )}
            </button>
          ))}
        </div>

        {/* 🚀 우측 스크롤 인디케이터 (탭이 더 있음을 시각적으로 알림) */}
        {hasMoreTabs && (
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0a0d14] via-[#0a0d14]/90 to-transparent flex items-center justify-end pr-2 pointer-events-none z-10 animate-in fade-in duration-300">
            <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-full border border-blue-500/30 animate-pulse flex items-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 pb-20 overflow-y-auto custom-scrollbar"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-sm">데이터 로드 중...</span>
          </div>
        )}
        {error && error === '아직 보고서 생성 전입니다.' ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-in fade-in duration-300 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(59,130,246,0.15)]">
              <FileText className="w-8 h-8 text-blue-400 opacity-80" />
            </div>
            <h3 className="text-base font-bold text-slate-200 mb-2">아직 보고서가 생성되지 않았습니다</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              AI 에이전트가 실시간 데이터를 수집 및 분석 중이거나 아직 워룸 리포트 생성이 요청되지 않은 상태입니다. 잠시 후 다시 확인해 주세요.
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mx-auto max-w-2xl">{error}</div>
        ) : null}
        {report && !loading && (
          <>
            {isTestIncident && (
              <div className="mb-4 bg-gradient-to-r from-rose-950/40 to-amber-950/40 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                <div className="flex-1 text-left">
                  <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">시뮬레이션 / 테스트용 데이터</h4>
                  <p className="text-[11px] text-slate-400">본 리포트는 테스트 키워드(테스트, test, demo 등)를 포함하여 감지된 가상 사건의 결과물입니다.</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-300 uppercase font-mono">TEST RUN</span>
              </div>
            )}
            {/* ── AI 분석 요약 ── */}
            {activeTab === 'summary' && (
              <div className="space-y-3 animate-in fade-in duration-300">
                {/* S-Autopilot Insight */}
                {report.autopilot_insight && (
                  <section className="bg-[#0f1421] rounded-2xl border border-blue-500/10 overflow-visible">
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5 bg-blue-500/5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-400">S-Autopilot Insight</span>
                      </div>
                      {report.similarity_score !== undefined && report.similarity_score !== null && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 rounded-lg border border-blue-500/20 shadow-lg shadow-blue-500/5">
                          <Zap className="w-3 h-3 text-blue-400 fill-blue-400/20" />
                          <span className="text-[10px] font-black text-blue-400 font-mono">
                            {Math.round(report.similarity_score * 100)}% Similarity
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {report.similarity_reason && (
                        <div className="mb-4 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex items-start gap-2.5 animate-in slide-in-from-top-1 duration-500">
                          <div className="mt-0.5 bg-blue-500/20 p-1.5 rounded-lg border border-blue-500/20 shadow-sm">
                            <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400/20" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest mb-1">AI Matching Rationale</p>
                            <p className="text-xs text-slate-300 font-medium italic leading-relaxed">
                              "{report.similarity_reason}"
                            </p>
                          </div>
                        </div>
                      )}
                      <MarkdownBlock text={report.autopilot_insight} report={report} checkedItems={checkedActionItems} onToggleCheck={toggleActionItem} />
                    </div>
                  </section>
                )}
                {/* Leader Summary */}
                {report.leader_summary && (
                  <section className="bg-[#0f1421] rounded-2xl border border-amber-500/10 overflow-visible">
                    <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5 bg-amber-500/5">
                      <Bot className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">Leader Agent 종합 요약</span>
                    </div>
                    <div className="p-4">
                      <MarkdownBlock text={report.leader_summary} report={report} checkedItems={checkedActionItems} onToggleCheck={toggleActionItem} />
                    </div>
                  </section>
                )}

                {/* ── [NEW] War-Room Response Timeline (moved to main summary tab) ── */}
                {chatSummary && (
                  <section className="bg-blue-600/5 rounded-2xl border border-blue-500/20 overflow-visible shadow-lg shadow-blue-500/5">
                    <div className="px-4 py-2.5 flex items-center gap-2 border-b border-blue-500/10 bg-blue-500/10">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">War-Room Response Timeline</span>
                    </div>
                    <div className="p-5 overflow-visible">
                      <MarkdownBlock text={formatTimeline(chatSummary)} report={report} checkedItems={checkedActionItems} onToggleCheck={toggleActionItem} />
                    </div>
                  </section>
                )}

                {!report.autopilot_insight && !report.leader_summary && !chatSummary && (
                  <div className="text-center py-10 text-slate-500 text-sm">분석 데이터가 없습니다.</div>
                )}
              </div>
            )}

            {/* ── Agent 로그 ── */}
            {activeTab === 'agents' && (
              <div className="space-y-2.5 animate-in fade-in duration-300">
                {(report.agent_logs || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">에이전트 로그가 없습니다.</div>
                )}
                {(report.agent_logs || []).map((log, i) => {
                  const cfg = agentColors[log.agent_role] || agentColors.Leader;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${cfg.text}`} />
                        <span className={`text-xs font-bold ${cfg.text}`}>{log.agent_role} Agent</span>
                        <span className="ml-auto text-[10px] text-slate-500">{log.reg_dt?.slice(0, 16)}</span>
                      </div>
                      <MarkdownBlock text={log.content} report={report} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── War-Room 채팅 전체 기록 ── */}
            {activeTab === 'chat' && (
              <div className="space-y-6 animate-in fade-in duration-300 overflow-visible">
                <section className="bg-blue-600/5 rounded-2xl border border-blue-500/20 overflow-visible shadow-lg shadow-blue-500/5">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-blue-500/10 bg-blue-500/10">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">War-Room Response Timeline</span>
                  </div>
                  <div className="p-5 overflow-visible">
                    {chatSummary ? (() => {
                      // [HH:MM:SS] or [HH:MM] 등 패턴 (뒤에 '이후' 등의 글자도 허용)
                      const raw = chatSummary;
                      const regex = /\[(\d{2}:\d{2}(?::\d{2})?[^\]]*)\]\s*/g;
                      const items = [];
                      let lastIndex = 0;
                      let match;
                      const timestamps = [];
                      while ((match = regex.exec(raw)) !== null) {
                        timestamps.push({ time: match[1], index: match.index, end: regex.lastIndex });
                      }
                      timestamps.forEach((ts, i) => {
                        const nextStart = timestamps[i + 1]?.index ?? raw.length;
                        const text = raw.slice(ts.end, nextStart).trim();
                        if (text) items.push({ time: ts.time, text });
                      });
                      // 타임스탬프 없으면 fallback
                      if (items.length === 0) {
                        return <MarkdownBlock text={formatTimeline(chatSummary)} report={report} />;
                      }

                      const icons = ['🚨','📡','🔍','🛠️','✅','📋','🔔','💡'];
                      const colors = [
                        { dot: 'bg-red-500', line: 'bg-red-500/30', badge: 'bg-red-500/15 border-red-500/30 text-red-400', card: 'border-red-500/20 bg-red-500/5' },
                        { dot: 'bg-orange-400', line: 'bg-orange-400/30', badge: 'bg-orange-500/15 border-orange-500/30 text-orange-400', card: 'border-orange-500/20 bg-orange-500/5' },
                        { dot: 'bg-yellow-400', line: 'bg-yellow-400/30', badge: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400', card: 'border-yellow-500/20 bg-yellow-500/5' },
                        { dot: 'bg-blue-500', line: 'bg-blue-500/30', badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400', card: 'border-blue-500/20 bg-blue-500/5' },
                        { dot: 'bg-violet-500', line: 'bg-violet-500/30', badge: 'bg-violet-500/15 border-violet-500/30 text-violet-400', card: 'border-violet-500/20 bg-violet-500/5' },
                        { dot: 'bg-emerald-500', line: 'bg-emerald-500/30', badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', card: 'border-emerald-500/20 bg-emerald-500/5' },
                        { dot: 'bg-cyan-500', line: 'bg-cyan-500/30', badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400', card: 'border-cyan-500/20 bg-cyan-500/5' },
                        { dot: 'bg-pink-500', line: 'bg-pink-500/30', badge: 'bg-pink-500/15 border-pink-500/30 text-pink-400', card: 'border-pink-500/20 bg-pink-500/5' },
                      ];

                      return (
                        <div className="relative">
                          {items.map((item, idx) => {
                            const c = colors[idx % colors.length];
                            const icon = icons[idx % icons.length];
                            const isLast = idx === items.length - 1;
                            return (
                              <div key={idx} className="flex gap-4 relative">
                                {/* 수직 연결선 + 점 */}
                                <div className="flex flex-col items-center shrink-0 w-8">
                                  <div className={`w-8 h-8 rounded-full ${c.dot} bg-opacity-20 border-2 border-opacity-60 flex items-center justify-center text-base shrink-0 shadow-lg`}
                                    style={{ borderColor: 'currentColor', boxShadow: `0 0 12px rgba(0,0,0,0.3)` }}>
                                    <span style={{ fontSize: 14 }}>{icon}</span>
                                  </div>
                                  {!isLast && (
                                    <div className={`w-0.5 flex-1 min-h-[24px] mt-1 ${c.line}`} />
                                  )}
                                </div>
                                {/* 카드 */}
                                <div className={`flex-1 mb-5 rounded-2xl border p-4 ${c.card} transition-all hover:brightness-110`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[11px] font-black font-mono px-2.5 py-1 rounded-lg border ${c.badge}`}>
                                      {item.time}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      STEP {idx + 1} / {items.length}
                                    </span>
                                    {isLast && (
                                      <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
                                        완료
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-200 leading-relaxed">{item.text}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })() : (
                      <div className="text-center py-10 text-slate-500 text-sm">
                        요약된 타임라인 정보가 없습니다. [AI 분석 요약] 탭에서 분석이 진행되었는지 확인해주세요.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}


            {/* ── 첨부파일 ── */}
            {activeTab === 'files' && (
              <div className="space-y-2 animate-in fade-in duration-300">
                {(report.attachments || []).length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">첨부파일이 없습니다.</div>
                )}
                {(report.attachments || []).map((att, i) => (
                  <a
                    key={i}
                    href={`${API_BASE_URL}${att.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#0f1421] rounded-xl p-3 border border-white/5 hover:border-blue-500/30 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Paperclip className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{att.original_name}</p>
                      <p className="text-[10px] text-slate-500">{att.uploaded_by} · {att.timestamp?.slice(0, 16)}</p>
                    </div>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 shrink-0">다운로드</span>
                  </a>
                ))}
              </div>
            )}

            {/* ── AI 종합보고서 ── */}
            {activeTab === 'ai_report' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {!aiGenText && !isGenerating && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                    <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles style={{ width: 26, height: 26, color: '#60a5fa' }} />
                    </div>
                    <p className="text-sm font-medium">데이터 분석을 바탕으로 종합 보고서를 생성합니다...</p>
                  </div>
                )}
                {isGenerating && !aiGenText && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                    <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
                    <p className="text-sm">Dify AI 전문가 분석 진행 중...</p>
                  </div>
                )}
                {aiGenText && (
                  <section style={{ background: 'linear-gradient(180deg, rgba(13,18,36,0.9) 0%, rgba(10,13,20,0.95) 100%)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.05)' }}>
                    {/* 헤더 */}
                    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(59,130,246,0.1)', background: 'rgba(59,130,246,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles style={{ width: 15, height: 15, color: '#60a5fa' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', margin: 0 }}>AI 종합 장애 보고서</p>
                          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Dify 전문가 멀티에이전트 분석 결과</p>
                        </div>
                        {isGenerating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8, padding: '3px 10px', background: 'rgba(59,130,246,0.15)', borderRadius: 20, border: '1px solid rgba(59,130,246,0.25)' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', animation: 'ping 1s ease-in-out infinite' }} />
                            <span style={{ fontSize: 10, color: '#93c5fd', fontWeight: 600 }}>분석 중...</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={generateAiReport}
                        disabled={isGenerating}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#64748b', fontSize: 11, fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.4 : 1, transition: 'all 0.2s' }}
                      >
                        <RefreshCw style={{ width: 11, height: 11, animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                        재생성
                      </button>
                    </div>

                    {/* 본문 */}
                    <div style={{ padding: '24px 28px', minHeight: 400 }}>
                      <MarkdownBlock text={aiGenText} report={report} />
                      {isGenerating && (
                        <span style={{ display: 'inline-block', width: 2, height: 18, background: '#3b82f6', animation: 'pulse 1s ease-in-out infinite', marginLeft: 4, verticalAlign: 'middle', borderRadius: 1 }} />
                      )}
                    </div>

                    {/* 푸터 */}
                    {!isGenerating && (
                      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>S-Guard AI · Dify 전문가 분석</span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{new Date().toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {modalStep && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => modalStep !== 'generating' && setModalStep(null)} />
          <div className="relative z-10 w-full max-w-2xl bg-[#0f1219] rounded-t-3xl border border-white/10 overflow-visible max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white">
                {modalStep === 'preview' ? '📋 보고서 최종 확인' : '📤 보고 대상 선정'}
              </h3>
              <button onClick={() => setModalStep(null)} className="p-1.5 rounded-full hover:bg-white/10">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {modalStep === 'preview' ? (
                <div className="space-y-3 text-sm">
                  {[
                    { k: 'WHO', v: report?.who }, { k: 'WHEN', v: report?.when },
                    { k: 'WHERE', v: report?.where }, { k: 'WHAT', v: report?.what },
                    { k: 'WHY', v: report?.why }, { k: 'HOW', v: report?.how },
                  ].map(({ k, v }) => (
                    <div key={k} className="bg-[#161b24] rounded-xl p-3 border border-white/5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{k}</span>
                      <p className="text-slate-300 mt-0.5 text-xs break-words">{v || '-'}</p>
                    </div>
                  ))}
                  {memo && <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/20 text-blue-200 text-xs italic">"{memo}"</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  {reportingLines.map(line => (
                    <div
                      key={line.id}
                      onClick={() => toggleLine(line.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedLines.includes(line.id) ? 'bg-blue-600/10 border-blue-500' : 'bg-[#161b2a]/50 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedLines.includes(line.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-200">{line.role} {line.name}</p>
                          <p className="text-[10px] text-slate-500">{line.desc}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedLines.includes(line.id) ? 'bg-blue-600 border-blue-400' : 'border-slate-600'}`}>
                        {selectedLines.includes(line.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 flex gap-3">
              <button
                onClick={() => modalStep === 'preview' ? setModalStep(null) : setModalStep('preview')}
                className="flex-1 h-12 rounded-2xl bg-slate-800 text-slate-300 text-sm font-bold hover:bg-slate-700 transition-all border border-white/5"
              >
                {modalStep === 'preview' ? '닫기' : '이전'}
              </button>
              <button
                onClick={() => modalStep === 'preview' ? setModalStep('selection') : (selectedLines.length > 0 && handleFinalSubmit())}
                disabled={modalStep === 'selection' && selectedLines.length === 0}
                className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {modalStep === 'preview' ? (<><span>보고라인 선택</span><ChevronRight className="w-4 h-4" /></>) : (<><span>최종 전송 ({selectedLines.length}명)</span><Send className="w-4 h-4" /></>)}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
