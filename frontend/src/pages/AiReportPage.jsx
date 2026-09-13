import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useTheme } from '../context/ThemeContext';
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

const getMdComponents = (isLight) => ({
  h1: ({ children }) => (
    <div style={{
      margin: '24px 0 16px',
      paddingBottom: 12,
      borderBottom: `2px solid ${isLight ? '#cbd5e1' : 'rgba(59,130,246,0.3)'}`
    }}>
      <h1 style={{
        fontSize: 18,
        fontWeight: 900,
        color: isLight ? '#0f172a' : '#f8fafc',
        letterSpacing: '-0.02em',
        lineHeight: 1.3,
        margin: 0
      }}>
        {children}
      </h1>
    </div>
  ),
  h2: ({ children }) => (
    <div style={{
      margin: '28px 0 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 8,
      borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}`
    }}>
      <div style={{
        width: 4,
        height: 18,
        borderRadius: 2,
        background: 'linear-gradient(180deg,#2563eb,#6366f1)',
        flexShrink: 0
      }} />
      <h2 style={{
        fontSize: 15,
        fontWeight: 800,
        color: isLight ? '#1d4ed8' : '#60a5fa',
        letterSpacing: '-0.01em',
        margin: 0
      }}>
        {children}
      </h2>
    </div>
  ),
  h3: ({ children }) => (
    <h3 style={{
      fontSize: 14,
      fontWeight: 700,
      color: isLight ? '#0f172a' : '#e2e8f0',
      margin: '20px 0 8px',
      paddingLeft: 10,
      borderLeft: `3px solid ${isLight ? '#2563eb' : '#3b82f6'}`
    }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <div className="md-p" style={{
      fontSize: 14,
      color: isLight ? '#0f172a' : '#e2e8f0',
      lineHeight: 1.8,
      marginBottom: 12,
      wordBreak: 'break-word',
      fontWeight: isLight ? 500 : 400
    }}>
      {children}
    </div>
  ),
  strong: ({ children }) => (
    <strong style={{
      color: isLight ? '#1e3a8a' : '#93c5fd',
      fontWeight: 800,
      background: isLight ? '#eff6ff' : 'rgba(59,130,246,0.18)',
      border: `1px solid ${isLight ? '#bfdbfe' : 'rgba(59,130,246,0.3)'}`,
      padding: '2px 8px',
      borderRadius: 6,
      display: 'inline-block',
      marginRight: 6,
      marginBottom: 2
    }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: isLight ? '#475569' : '#94a3b8', fontStyle: 'italic' }}>{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      margin: '16px 0',
      padding: '14px 18px',
      background: isLight ? '#f8fafc' : 'rgba(30,41,59,0.5)',
      borderLeft: `4px solid ${isLight ? '#2563eb' : '#3b82f6'}`,
      borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
      borderRight: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
      borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: '0 12px 12px 0',
      color: isLight ? '#0f172a' : '#e2e8f0',
      fontSize: 13.5,
      lineHeight: 1.8
    }}>
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) => inline
    ? <code style={{
        background: isLight ? '#f1f5f9' : 'rgba(16,185,129,0.15)',
        color: isLight ? '#0f172a' : '#34d399',
        fontSize: 12,
        padding: '2px 7px',
        borderRadius: 6,
        fontFamily: 'monospace',
        border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(16,185,129,0.3)'}`,
        fontWeight: 600
      }}>{children}</code>
    : (
      <pre style={{
        background: isLight ? '#f8fafc' : '#0b101d',
        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 12,
        padding: '16px 18px',
        margin: '14px 0',
        overflowX: 'auto',
        fontSize: 12,
        color: isLight ? '#0f172a' : '#6ee7b7',
        fontFamily: 'monospace',
        lineHeight: 1.7
      }}>
        <code>{children}</code>
      </pre>
    ),
  ul: ({ children }) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyleType: 'decimal', paddingLeft: 22, margin: '10px 0', display: 'flex', flexDirection: 'column', gap: 6, color: isLight ? '#0f172a' : '#e2e8f0' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      fontSize: 14,
      color: isLight ? '#0f172a' : '#e2e8f0',
      lineHeight: 1.7,
      fontWeight: isLight ? 500 : 400
    }}>
      <span style={{
        marginTop: 8,
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: isLight ? '#2563eb' : '#3b82f6',
        flexShrink: 0,
        display: 'inline-block'
      }} />
      <div style={{ flex: 1, wordBreak: 'break-word', color: isLight ? '#0f172a' : '#e2e8f0' }}>{children}</div>
    </li>
  ),
  hr: () => (
    <div style={{ margin: '24px 0', height: 1, background: isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)' }} />
  ),
  table: ({ children }) => (
    <div style={{
      overflowX: 'auto',
      margin: '18px 0',
      borderRadius: 14,
      border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)'}`,
      background: isLight ? '#ffffff' : '#0b101d',
      boxShadow: isLight ? '0 2px 10px rgba(0,0,0,0.04)' : '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, wordBreak: 'keep-all' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{
      background: isLight ? '#f1f5f9' : '#161f33',
      borderBottom: `2px solid ${isLight ? '#94a3b8' : 'rgba(59,130,246,0.4)'}`
    }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '13px 18px',
      textAlign: 'left',
      fontWeight: 800,
      color: isLight ? '#0f172a' : '#93c5fd',
      background: isLight ? '#f1f5f9' : '#161f33',
      fontSize: 12,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      minWidth: 110,
      borderBottom: `2px solid ${isLight ? '#cbd5e1' : 'rgba(59,130,246,0.3)'}`
    }}>
      {children}
    </th>
  ),
  tbody: ({ children }) => (
    <tbody style={{
      background: isLight ? '#ffffff' : '#0b101d'
    }}>{children}</tbody>
  ),
  tr: ({ children }) => (
    <tr
      style={{ transition: 'background 0.15s', background: isLight ? '#ffffff' : '#0b101d' }}
      onMouseEnter={e => e.currentTarget.style.background = isLight ? '#f8fafc' : '#161f33'}
      onMouseLeave={e => e.currentTarget.style.background = isLight ? '#ffffff' : '#0b101d'}
    >
      {children}
    </tr>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '13px 18px',
      color: isLight ? '#0f172a' : '#e2e8f0',
      background: isLight ? '#ffffff' : '#0b101d',
      borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
      verticalAlign: 'top',
      wordBreak: 'break-word',
      fontSize: 13,
      fontWeight: isLight ? 500 : 400
    }}>
      {children}
    </td>
  ),
});

// ── [NEW] 텍스트 내의 **굵은글씨**, 라벨: 등을 파싱하여 ** 기호를 완전히 없애고 시각적으로 볼드 처리 ──
function renderLineContent(rawText, isLight) {
  if (!rawText) return null;

  // 1. 앞쪽의 **가 누락되어 "라벨:** 내용" 형태로 된 경우 복원/정규화
  let normalized = String(rawText).replace(/^([^*:\n]{1,40}):\*\*\s*/, '**$1:** ');

  // 2. **...** 쌍 파싱
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
  
  if (parts.length === 1) {
    const cleanText = normalized.replace(/\*\*/g, '').trim();

    // "라벨: 내용" 형태인 경우 라벨 볼드 처리 (시간 패턴 e.g. 17:52:54 제외)
    const colonIdx = cleanText.indexOf(':');
    const isTime = /\d{1,2}:\d{2}/.test(cleanText.slice(0, Math.max(0, colonIdx)));
    if (colonIdx > 0 && colonIdx < 35 && !isTime) {
      const label = cleanText.slice(0, colonIdx).trim();
      const val = cleanText.slice(colonIdx + 1).trim();
      return (
        <span>
          <strong className={`font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>{label}:</strong>{' '}
          <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{val}</span>
        </span>
      );
    }

    return <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{cleanText}</span>;
  }

  // ** 쌍이 있는 경우 분할 렌더링
  return (
    <span>
      {parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2).trim();
          return (
            <strong key={pIdx} className={`font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {inner}
            </strong>
          );
        }
        const cleanedPart = part.replace(/\*\*/g, '');
        return (
          <span key={pIdx} className={isLight ? 'text-slate-800' : 'text-slate-200'}>
            {cleanedPart}
          </span>
        );
      })}
    </span>
  );
}

// ── [NEW] 워룸 타임라인 단락/서식 특화 렌더러 (일목요연한 단락/헤더/불릿 분리 및 ** 기호 완벽 제거) ──
function WarRoomStepContent({ text, isLight, isLast }) {
  if (!text) return null;

  const hasSections = text.includes('---') || text.includes('###') || /(?:^|\s)[1-9]\d?\.\s+/.test(text);

  // 일반 텍스트 포맷터 (단락 및 줄바꿈/불릿 정리)
  if (!hasSections) {
    const clean = text.trim();
    const lines = clean
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => {
        // 불릿 기호(-, •, *, ·)만 있고 실제 내용이 없는 빈 줄 필터링 (불필요한 고립 불릿 점 방지)
        const stripped = l.replace(/^[-•*·]\s*/, '').replace(/\*\*/g, '').trim();
        return stripped.length > 0;
      });

    if (lines.length > 1) {
      return (
        <div className="flex flex-col gap-2 w-full">
          {lines.map((line, idx) => {
            const isBullet = line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || line.startsWith('·');
            const content = isBullet ? line.replace(/^[-•*·]\s*/, '').trim() : line.trim();
            if (!content) return null;
            return (
              <div key={idx} className="flex items-start gap-2 text-xs sm:text-[13px] leading-relaxed">
                {isBullet && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isLight ? 'bg-blue-600' : 'bg-blue-400'}`} />
                )}
                <div className="flex-1 min-w-0">
                  {renderLineContent(content, isLight)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (clean.includes(' - ')) {
      const segments = clean
        .split(/\s+-\s+/)
        .map(s => s.trim())
        .filter(s => s.replace(/^[-•*·]\s*/, '').replace(/\*\*/g, '').trim().length > 0);
      if (segments.length > 1) {
        return (
          <div className="flex flex-col gap-2 w-full">
            {segments.map((seg, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs sm:text-[13px] leading-relaxed">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isLight ? 'bg-blue-600' : 'bg-blue-400'}`} />
                <div className="flex-1 min-w-0">
                  {renderLineContent(seg, isLight)}
                </div>
              </div>
            ))}
          </div>
        );
      }
    }

    return (
      <div className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
        {renderLineContent(clean, isLight)}
      </div>
    );
  }

  // --- 구분자 및 ### 헤더 분리
  const rawParts = text.split(/\s*(?:---+|(?=###\s+))\s*/).map(p => p.trim()).filter(Boolean);

  const sectionColors = {
    '1': { badge: isLight ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-rose-500/20 text-rose-300 border-rose-500/30', dot: isLight ? 'bg-rose-500' : 'bg-rose-400' },
    '2': { badge: isLight ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: isLight ? 'bg-amber-500' : 'bg-amber-400' },
    '3': { badge: isLight ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', dot: isLight ? 'bg-cyan-500' : 'bg-cyan-400' },
    '4': { badge: isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: isLight ? 'bg-emerald-500' : 'bg-emerald-400' },
    '5': { badge: isLight ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-500/20 text-purple-300 border-purple-500/30', dot: isLight ? 'bg-purple-500' : 'bg-purple-400' },
  };

  return (
    <div className="flex flex-col gap-3 w-full mt-1">
      {rawParts.map((part, partIdx) => {
        // Case A: RCA / 핵심 원인
        if (part.includes('핵심 원인') || part.includes('Root Cause') || part.includes('💡')) {
          const titleMatch = part.match(/###\s*(.+?)(?:\s*>|\n|$)/);
          const rcaTitle = titleMatch ? titleMatch[1].replace(/^[#\s]+/, '').replace(/\*\*/g, '').trim() : '핵심 원인 (Root Cause Analysis)';
          const quoteText = part.replace(/###.+?(?:\s*>|\n|$)/, '').replace(/^>\s*/gm, '').trim();

          return (
            <div 
              key={partIdx} 
              className={`rounded-xl p-3.5 border transition-all ${
                isLight 
                  ? 'bg-amber-50/90 border-amber-200/90 shadow-sm' 
                  : 'bg-amber-500/10 border-amber-500/30 shadow-inner'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base shrink-0">💡</span>
                <span className={`text-xs font-black tracking-wide ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>
                  {rcaTitle.replace(/^💡\s*/, '')}
                </span>
                <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  isLight ? 'bg-amber-200/70 text-amber-900 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  RCA
                </span>
              </div>
              <div className={`text-xs sm:text-[12.5px] leading-relaxed font-medium pl-3 border-l-2 ${
                isLight ? 'border-amber-400 text-slate-800' : 'border-amber-500/60 text-slate-100'
              }`}>
                {renderLineContent(quoteText, isLight)}
              </div>
            </div>
          );
        }

        // Case B: Final Report / 최종 보고서 및 넘버링 세션
        if (part.includes('최종 보고서') || part.includes('Resolution Report') || /(?:^|\s)[1-9]\d?\.\s+/.test(part)) {
          const titleMatch = part.match(/^###\s*([^\d\n]+?)(?=\s*[1-9]\d?\.\s+|$)/);
          const reportTitle = titleMatch ? titleMatch[1].replace(/^[#\s]+/, '').replace(/\*\*/g, '').trim() : '최종 보고서 (Resolution Report)';
          const body = titleMatch ? part.slice(titleMatch[0].length).trim() : part;

          const sectionRegex = /(?:^|\s)([1-9]\d?)\.\s+([^-\n:]+?)(?=\s*-\s*|\s*[1-9]\d?\.\s+|$)/g;
          const sections = [];
          let match;
          const indices = [];
          while ((match = sectionRegex.exec(body)) !== null) {
            indices.push({ num: match[1], title: match[2].trim(), index: match.index, end: sectionRegex.lastIndex });
          }

          if (indices.length > 0) {
            indices.forEach((sec, idx) => {
              const nextStart = indices[idx + 1] ? indices[idx + 1].index : body.length;
              const content = body.slice(sec.end, nextStart).trim();
              const bullets = content.split(/(?:^|\s)-\s+/).map(b => b.trim()).filter(b => b.replace(/^[-•*·]\s*/, '').replace(/\*\*/g, '').trim().length > 0);
              sections.push({ num: sec.num, title: sec.title, bullets });
            });
          }

          return (
            <div 
              key={partIdx} 
              className={`rounded-xl p-3.5 border transition-all ${
                isLight 
                  ? 'bg-slate-50/90 border-slate-200/90 shadow-sm' 
                  : 'bg-slate-900/60 border-white/10 shadow-inner'
              }`}
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-inherit">
                <span className="text-base shrink-0">📋</span>
                <span className={`text-xs font-black tracking-wide ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {reportTitle.replace(/^✅\s*/, '')}
                </span>
                <span className={`ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  isLight ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  REPORT
                </span>
              </div>

              {sections.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {sections.map((sec) => {
                    const col = sectionColors[sec.num] || {
                      badge: isLight ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                      dot: isLight ? 'bg-blue-500' : 'bg-blue-400'
                    };

                    return (
                      <div 
                        key={sec.num} 
                        className={`p-3 rounded-lg border flex flex-col gap-2 ${
                          isLight 
                            ? 'bg-white border-slate-200/80 shadow-xs' 
                            : 'bg-[#0b101d]/70 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-black shrink-0 border ${col.badge}`}>
                            {sec.num}
                          </span>
                          <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                            {renderLineContent(sec.title, isLight)}
                          </span>
                        </div>

                        {sec.bullets.length > 0 && (
                          <div className="flex flex-col gap-1.5 pl-6">
                            {sec.bullets.map((b, bIdx) => {
                              // 1. 타임스탬프 시작 감지 e.g. "17:52:54 거래집계..."
                              const timeMatch = b.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/);
                              if (timeMatch) {
                                return (
                                  <div key={bIdx} className="flex items-start gap-2 text-xs sm:text-[12px] leading-relaxed">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                      isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    }`}>
                                      {timeMatch[1]}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      {renderLineContent(timeMatch[2], isLight)}
                                    </div>
                                  </div>
                                );
                              }

                              // 2. 키-밸류 라벨 감지 e.g. "서비스 영향 범위: ..."
                              const cleanB = b.replace(/\*\*/g, '');
                              const colonIdx = cleanB.indexOf(':');
                              const keyCandidate = colonIdx > 0 ? cleanB.slice(0, colonIdx).trim() : '';
                              const isTimestamp = /\d{1,2}:\d{2}/.test(keyCandidate);
                              const hasKeyValue = colonIdx > 0 && colonIdx < 30 && !isTimestamp && !/^\d+$/.test(keyCandidate);
                              const keyPart = hasKeyValue ? keyCandidate : null;
                              const valPart = hasKeyValue ? cleanB.slice(colonIdx + 1).trim() : cleanB;

                              return (
                                <div key={bIdx} className="flex items-start gap-2 text-xs sm:text-[12px] leading-relaxed">
                                  {keyPart ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      isLight ? 'bg-slate-200/80 text-slate-800 border border-slate-300' : 'bg-white/10 text-slate-200 border border-white/15'
                                    }`}>
                                      {keyPart}
                                    </span>
                                  ) : (
                                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${col.dot}`} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    {renderLineContent(valPart, isLight)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-xs sm:text-[12px] leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {renderLineContent(body, isLight)}
                </div>
              )}
            </div>
          );
        }

        // Case C: Standard status or note paragraph (조치 현황 등)
        const cleanPart = part.replace(/\*\*/g, '').replace(/^-+\s*/gm, '').trim();
        const colonIdx = cleanPart.indexOf(':');
        const hasPrefix = colonIdx > 0 && colonIdx < 30;
        const prefix = hasPrefix ? cleanPart.slice(0, colonIdx).trim() : null;
        const rest = hasPrefix ? cleanPart.slice(colonIdx + 1).trim() : cleanPart;

        return (
          <div 
            key={partIdx} 
            className={`rounded-xl p-3 border transition-all ${
              isLight 
                ? 'bg-blue-50/70 border-blue-200/80 shadow-xs' 
                : 'bg-blue-500/10 border-blue-500/25'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-base shrink-0 mt-0.5">🔍</span>
              <div className="flex-1 min-w-0">
                {prefix && (
                  <div className={`text-xs font-bold mb-1 flex items-center gap-1.5 ${isLight ? 'text-blue-950' : 'text-blue-300'}`}>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                      isLight ? 'bg-blue-200/70 text-blue-900 border border-blue-300/60' : 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                    }`}>
                      조치 현황
                    </span>
                    <span>{renderLineContent(prefix, isLight)}</span>
                  </div>
                )}
                <div className={`text-xs sm:text-[12.5px] leading-relaxed ${isLight ? 'text-slate-800 font-medium' : 'text-slate-200'}`}>
                  {renderLineContent(rest, isLight)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarkdownBlock({ text, report, checkedItems = {}, onToggleCheck = () => {} }) {
  const { isLight } = useTheme();
  if (!text) return <span style={{ color: isLight ? '#64748b' : '#475569' }}>-</span>;
  
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

  // 2. 유니코드 글머리 기호(•, ●)를 마크다운 목록 기호(- )로 표준화 및 테이블 서식 보정
  clean = clean.replace(/^([ \t]*)[•●]\s*/gm, '$1- ');
  clean = clean.replace(/([^\n])\n(\s*\|.*?\|)/g, '$1\n\n$2');

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

  const customComponents = useMemo(() => {
    const base = getMdComponents(isLight);
    return {
      ...base,
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
              className={`flex items-start gap-3 p-3.5 my-2.5 rounded-2xl border transition-all cursor-pointer select-none shadow-sm text-left ${
                isChecked 
                  ? (isLight ? 'bg-emerald-50 border-emerald-300 text-slate-400 line-through' : 'bg-emerald-500/10 border-emerald-500/30 text-slate-400 line-through') 
                  : (isLight ? 'bg-white border-blue-200 hover:border-blue-500 text-slate-900 font-bold shadow-xs' : 'bg-[#161b2a] border-blue-500/30 hover:border-blue-500 text-slate-100 font-bold')
              }`}
            >
              <div className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                isChecked
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : (isLight ? 'border-slate-400 bg-slate-100 text-transparent' : 'border-slate-500 bg-black/40 text-transparent')
              }`}>
                <Check size={14} className="stroke-[3]" />
              </div>
              <div className={`flex-1 text-xs leading-relaxed break-words ${isChecked ? 'text-slate-400' : (isLight ? 'text-slate-900' : 'text-slate-100')}`}>{cleanText}</div>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-black uppercase shrink-0 ${
                isChecked
                  ? (isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]')
                  : (isLight ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30')
              }`}>
                {isChecked ? 'Done' : 'Action'}
              </span>
            </li>
          );
        }
        
        return (
          <li style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            fontSize: 13.5,
            color: isLight ? '#0f172a' : '#cbd5e1',
            lineHeight: 1.7,
            fontWeight: isLight ? 500 : 400
          }}>
            <span style={{
              marginTop: 7,
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: isLight ? '#2563eb' : '#3b82f6',
              flexShrink: 0,
              display: 'inline-block'
            }} />
            <div style={{ flex: 1, wordBreak: 'break-word', color: isLight ? '#0f172a' : '#cbd5e1' }}>{children}</div>
          </li>
        );
      }
    };
  }, [isLight, checkedItems, onToggleCheck]);

  return (
    <div className="markdown-body-custom" style={{ fontSize: 13.5, lineHeight: 1.8, wordBreak: 'break-word', color: isLight ? '#0f172a' : '#cbd5e1' }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>{clean}</ReactMarkdown>
    </div>
  );
}


const getSeverityColors = (isLight) => ({
  CRITICAL: isLight ? 'bg-red-100 text-red-800 border-red-300' : 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     isLight ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  NORMAL:   isLight ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  INFO:     isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-500/20 text-slate-400 border-slate-500/40',
});

const getAgentColors = (isLight) => ({
  Security: {
    bg: isLight ? 'bg-red-50 border-red-200' : 'bg-red-500/15 border-red-500/30',
    text: isLight ? 'text-red-800' : 'text-red-400',
    icon: Shield
  },
  DB: {
    bg: isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-500/15 border-purple-500/30',
    text: isLight ? 'text-purple-800' : 'text-purple-400',
    icon: Database
  },
  DevOps: {
    bg: isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-green-500/15 border-green-500/30',
    text: isLight ? 'text-emerald-800' : 'text-green-400',
    icon: Server
  },
  Leader: {
    bg: isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-500/15 border-amber-500/30',
    text: isLight ? 'text-amber-900' : 'text-amber-400',
    icon: Bot
  },
});

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
  const { isLight } = useTheme();
  const location = useLocation();
  const params = useParams();
  
  const rawId = params.incidentId || location.state?.incidentId;
  const incidentId = rawId ? String(rawId).replace("INC-", "").trim() : null;
  const currentUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');

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
    return text
      .replace(/(?:\*\*|\s*)\[(\d{2}:\d{2}(?::\d{2})?[^\]]*)\](?:\*\*|\s*)*/g, '\n\n- **[$1]** ')
      .replace(/\s*---\s*/g, '\n\n---\n\n')
      .replace(/\s*(###\s+[^\n]+)/g, '\n\n$1\n\n')
      .replace(/(?:^|\s)([1-9]\d?\.\s+[가-힣][^\-\n:]*?)\s*-\s+/g, '\n\n#### $1\n- ')
      .replace(/\s*-\s+/g, '\n- ')
      .trim();
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
      <div className={`min-h-[100dvh] font-sans flex flex-col pb-24 select-none overflow-y-auto ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0d14] text-white'}`}>
        {/* ── Sticky Header (Slim 1-line + Quick Search) ───────────── */}
        <header className={`sticky top-0 z-50 backdrop-blur-xl border-b flex flex-col gap-2.5 px-4 py-3 ${isLight ? 'bg-white/95 border-slate-200 shadow-xs' : 'bg-[#0a0d14]/95 border-white/5'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button onClick={() => goBack()} className={`p-2 rounded-xl transition-colors ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-slate-400'}`}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Sparkles className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} /> AI 장애 보고서
                </h1>
                <p className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  {srchParams.startDate.substring(2).replace(/-/g, '.')} ~ {srchParams.endDate.substring(2).replace(/-/g, '.')}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowFilterSheet(true)}
              className={`skeuo-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer ${isLight ? 'bg-blue-50 border border-blue-200 text-blue-700 shadow-sm' : 'bg-blue-500/15 border border-blue-500/40 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]'}`}
            >
              <Filter size={14} />
              <span>상세 필터</span>
              {(srchParams.keyword || srchParams.incidentId || srchParams.assignee) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
            </button>
          </div>

          {/* 빠른 키워드 검색 바 */}
          <div className={`flex items-center rounded-xl px-3 py-1.5 transition-colors border ${isLight ? 'bg-slate-100 border-slate-200 focus-within:border-blue-500 focus-within:bg-white' : 'bg-black/40 border-white/10 focus-within:border-blue-500/50'}`}>
            <Search size={14} className={`${isLight ? 'text-slate-500' : 'text-slate-400'} mr-2 shrink-0`} />
            <input
              type="text" placeholder="제목 · ID · 메시지 빠른 검색"
              value={srchParams.keyword}
              onChange={e => { const v = e.target.value; setSrchParams(p => ({ ...p, keyword: v })); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleListSearch(); } }}
              className={`w-full bg-transparent py-1 text-xs focus:outline-none ${isLight ? 'text-slate-900 placeholder-slate-400' : 'text-white placeholder-slate-500'}`}
            />
            {srchParams.keyword && (
              <button onClick={() => { setSrchParams(p => ({ ...p, keyword: '' })); }} className="p-1 hover:opacity-80">
                <X size={12} className={isLight ? 'text-slate-500' : 'text-slate-400'} />
              </button>
            )}
          </div>
        </header>

        {/* ── Sticky 요약 카드 (Summary Cards - 필터링 연동) ──────────────────────── */}
        <div className={`sticky top-[102px] z-40 backdrop-blur-md px-4 py-3 border-b ${isLight ? 'bg-white/90 border-slate-200 shadow-xs' : 'bg-[#0a0d14]/90 border-white/5 shadow-lg'}`}>
          <div className="grid grid-cols-3 gap-2.5 max-w-5xl mx-auto">
            {[{label:'전체 장애', val:'', count:srchStats.total, color:'blue', border: isLight ? 'border-blue-200' : 'border-blue-500/30', bg: isLight ? 'bg-blue-50/90' : 'bg-blue-500/5', text: isLight ? 'text-blue-700' : 'text-blue-400'},
              {label:'CRITICAL', val:'CRITICAL', count:srchStats.critical, color:'red', border: isLight ? 'border-red-200' : 'border-red-500/40', bg: isLight ? 'bg-red-50/90' : 'bg-red-500/5', text: isLight ? 'text-red-700' : 'text-red-400'},
              {label:'HIGH / MAJOR', val:'HIGH', count:srchStats.high, color:'orange', border: isLight ? 'border-orange-200' : 'border-orange-500/40', bg: isLight ? 'bg-orange-50/90' : 'bg-orange-500/5', text: isLight ? 'text-orange-700' : 'text-orange-400'}].map(s => {
              const active = srchParams.severity === s.val;
              return (
                <button
                  key={s.label}
                  onClick={() => setSrchParams(p => ({ ...p, severity: s.val }))}
                  className={`border rounded-xl p-2.5 text-center flex flex-col justify-center transition-all cursor-pointer select-none active:scale-95 ${active ? (isLight ? `border-${s.color}-500 bg-${s.color}-100/80 shadow-sm ring-2 ring-${s.color}-400/30` : `border-${s.color}-400 bg-${s.color}-500/20 shadow-[0_0_15px_rgba(${s.color === 'red' ? '239,68,68': s.color === 'orange' ? '249,115,22' : '59,130,246'},0.3)]`) : `${s.bg} ${s.border} ${isLight ? 'opacity-90 hover:opacity-100 shadow-xs' : 'opacity-70 hover:opacity-100'}`}`}
                >
                  <p className={`text-xl font-black font-mono leading-none ${s.text}`}>{s.count}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{s.label}</p>
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
              <span className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>장애 이력 실시간 필터링 중...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 rounded-2xl text-center my-4 border ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-white/5 border-white/10'}`}>
              <FileText size={36} className={`${isLight ? 'text-slate-400' : 'text-slate-600'} mb-3`} />
              <p className={`text-sm font-black mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>검색 결과가 없습니다</p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>상단 필터 버튼을 눌러 조건을 변경해 보세요</p>
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
                <div className={`flex flex-col items-center justify-center py-16 rounded-2xl text-center my-4 border ${isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-white/5 border-white/10'}`}>
                  <AlertCircle size={36} className={`${isLight ? 'text-slate-400' : 'text-slate-600'} mb-3`} />
                  <p className={`text-sm font-black mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>선택된 심각도에 해당하는 장애가 없습니다</p>
                  <button onClick={() => setSrchParams(p => ({ ...p, severity: '' }))} className="text-xs text-blue-600 font-bold mt-2 underline cursor-pointer">전체 장애 보기</button>
                </div>
              );
            }

            return (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>조회된 장애 <strong className={isLight ? 'text-blue-600' : 'text-blue-400'}>{displayList.length}</strong>건</span>
                  <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white/5 text-slate-500 border-white/10'}`}>최신 발생순</span>
                </div>
                {displayList.map(inc => {
                  const sev = (inc.severity || 'NORMAL').toUpperCase();
                  const sc = isLight
                    ? (sev === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200 font-bold' :
                       sev === 'HIGH' || sev === 'MAJOR' ? 'bg-orange-50 text-orange-700 border-orange-200 font-bold' :
                       sev === 'NORMAL' ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200')
                    : (sev === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/40' :
                       sev === 'HIGH' || sev === 'MAJOR' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                       sev === 'NORMAL' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-slate-500/20 text-slate-400 border-slate-500/40');
                  
                  const st = String(inc.status || '').toUpperCase();
                  const isComplete = st.includes('완료') || st.includes('COMPLETED') || st === 'INC_003' || st === 'CLOSED' || st === '정상';
                  const isProgress = st.includes('분석중') || st.includes('처리중') || st.includes('PROGRESS') || st === 'INC_002';
                  
                  const statusCls = isLight
                    ? (isComplete ? 'bg-slate-100 border-slate-200 text-slate-600 font-medium' :
                       isProgress ? 'bg-amber-50 border-amber-300 text-amber-800 font-black animate-pulse shadow-xs' :
                       'bg-blue-50 border-blue-200 text-blue-700 font-bold')
                    : (isComplete ? 'bg-slate-500/10 border-slate-500/20 text-slate-400 font-normal' :
                       isProgress ? 'bg-[#ff8800]/15 border-[#ff8800]/40 text-[#ff8800] font-black animate-pulse shadow-[0_0_10px_rgba(255,136,0,0.2)]' :
                       'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold');
                  const statusName = isComplete ? '처리완료' : isProgress ? '분석중' : getStatusName(inc.status);
                  const assignee = inc.assignee_name || inc.assigned_to || '-';

                  return (
                    <div
                      key={inc.inc_id}
                      onClick={() => navigate(`/ai-report/${inc.inc_id}`)}
                      className={`p-4 rounded-2xl transition-all duration-300 flex flex-col gap-2.5 cursor-pointer relative overflow-hidden active:scale-[0.98] group border ${
                        isLight 
                          ? 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-sm hover:shadow-md' 
                          : 'skeuo-card bg-[#12151a] hover:bg-[#1a1f26] border-white/10 shadow-xl'
                      }`}
                    >
                      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: sev === 'CRITICAL' ? '#ef4444' : sev === 'HIGH' || sev === 'MAJOR' ? '#f59e0b' : '#3b82f6' }} />
                      
                      <div className="flex items-center justify-between pl-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wide ${sc}`}>{sev}</span>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${statusCls}`}>{statusName}</span>
                        </div>
                        <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{inc.created_at?.slice(0, 16) || '-'}</span>
                      </div>

                      <div className="pl-2 pr-1">
                        <h3 className={`text-sm font-black leading-snug break-words line-clamp-3 transition-colors ${
                          isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-400'
                        }`}>
                          {(inc.title || '').replace(/^INC-[\w-]+\s*\|\s*/i, '') || `INC-${inc.inc_id}`}
                        </h3>
                        {inc.message && (
                          <p className={`text-xs line-clamp-2 mt-1.5 font-normal leading-relaxed ${
                            isLight ? 'text-slate-600' : 'text-slate-400'
                          }`}>{inc.message}</p>
                        )}
                      </div>

                      <div className={`flex items-center justify-between pt-2.5 pl-2 mt-1 border-t ${
                        isLight ? 'border-slate-100' : 'border-white/5'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-mono tracking-tighter truncate max-w-[140px] ${
                            isLight ? 'text-slate-500' : 'text-slate-500'
                          }`}>INC-{inc.inc_id}</span>
                          {assignee !== '-' && <span className={`text-[10px] font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>담당: {assignee}</span>}
                        </div>
                        <div className={`flex items-center gap-0.5 text-[11px] font-bold group-hover:translate-x-1 transition-transform shrink-0 ${
                          isLight ? 'text-blue-600' : 'text-blue-400'
                        }`}>
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
            <div className={`border-t rounded-t-3xl p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto select-none ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12151a] border-white/10 text-white'
            }`} onClick={e => e.stopPropagation()}>
              <div className={`w-12 h-1 rounded-full mx-auto mb-1 ${isLight ? 'bg-slate-300' : 'bg-white/20'}`} />
              
              <div className={`flex items-center justify-between border-b pb-4 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <h2 className={`text-base font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Filter className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} /> 상세 검색 필터
                </h2>
                <button onClick={() => setShowFilterSheet(false)} className={`p-1.5 rounded-full transition-colors cursor-pointer ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>장애 ID</label>
                    <input
                      type="text" placeholder="INC-번호 입력"
                      value={srchParams.incidentId}
                      onChange={e => setSrchParams(p => ({ ...p, incidentId: e.target.value }))}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-xs focus:outline-none ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white' : 'bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:border-blue-500/50'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>처리자</label>
                    <select
                      value={srchParams.assignee}
                      onChange={e => setSrchParams(p => ({ ...p, assignee: e.target.value }))}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-xs focus:outline-none ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white' : 'bg-black/40 border border-white/10 text-white focus:border-blue-500/50'}`}
                    >
                      <option value="">전체 담당자</option>
                      {allUsers.map(u => <option key={u.employee_id} value={u.name}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} /> 조회 기간
                    </label>
                    <div className="flex gap-1">
                      {[[1,'오늘'],[7,'7일'],[30,'30일'],[90,'90일']].map(([d,l]) => (
                        <button key={d} type="button" onClick={() => handleQuickDate(d)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={srchParams.startDate} onChange={e => setSrchParams(p => ({...p, startDate: e.target.value}))} className={`rounded-xl px-3 py-2 text-xs ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900' : 'bg-black/40 border border-white/10 text-white'}`} style={{colorScheme: isLight ? 'light' : 'dark'}} />
                    <input type="date" value={srchParams.endDate} onChange={e => setSrchParams(p => ({...p, endDate: e.target.value}))} className={`rounded-xl px-3 py-2 text-xs ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900' : 'bg-black/40 border border-white/10 text-white'}`} style={{colorScheme: isLight ? 'light' : 'dark'}} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>심각도</label>
                    <select value={srchParams.severity} onChange={e => setSrchParams(p => ({...p, severity: e.target.value}))} className={`w-full rounded-xl px-3.5 py-2.5 text-xs focus:outline-none ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white' : 'bg-black/40 border border-white/10 text-white focus:border-blue-500/50'}`}>
                      <option value="">전체</option>
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH / MAJOR</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="INFO">INFO</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>처리 상태</label>
                    <select value={srchParams.status} onChange={e => setSrchParams(p => ({...p, status: e.target.value}))} className={`w-full rounded-xl px-3.5 py-2.5 text-xs focus:outline-none ${isLight ? 'bg-slate-100 border border-slate-200 text-slate-900 focus:border-blue-500 focus:bg-white' : 'bg-black/40 border border-white/10 text-white focus:border-blue-500/50'}`}>
                      <option value="">전체</option>
                      <option value="처리완료">처리완료</option>
                      <option value="처리중">처리중 / 분석중</option>
                      <option value="대기">대기</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={`flex items-center gap-3 pt-4 border-t mt-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <button onClick={() => { const p = { incidentId:'', keyword:'', ...getDefaultDates(), severity:'', status:'처리완료', assignee:'' }; setSrchParams(p); }} className={`px-4 py-3 rounded-xl text-xs font-bold cursor-pointer border ${isLight ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
                  초기화
                </button>
                <button onClick={() => { handleListSearch(); setShowFilterSheet(false); }} className={`flex-1 py-3.5 font-black text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer ${isLight ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : 'bg-gradient-to-r from-blue-500 to-blue-400 text-black shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>
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
  const sevColors = getSeverityColors(isLight);
  const sevClass = sevColors[sev] || sevColors.NORMAL;

  return (
    <div className={`h-[100dvh] font-sans flex flex-col overflow-hidden ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0d14] text-white'}`}>
      {/* Header — 2줄 풀-width */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#0a0d14]/95 border-white/5'}`}>
        {/* Row 1: 네비게이션 + 타이틀 */}
        <div className="max-w-5xl mx-auto w-full flex items-center gap-2 px-3 py-2">
          <button onClick={() => goBack()} className={`shrink-0 p-2 rounded-full transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/5 text-slate-400'}`}>
            <ArrowLeft className="w-5 h-5" />
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
                  <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                    INC-{incidentId}
                  </span>
                  {isTestIncident && (
                    <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/35 uppercase tracking-tighter animate-pulse">
                      TEST
                    </span>
                  )}
                  {report.similarity_score != null && (
                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg ${isLight ? 'text-blue-700 bg-blue-50 border border-blue-200' : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'}`}>
                      <Zap className={`w-2.5 h-2.5 ${isLight ? 'fill-blue-600/30' : 'fill-blue-400/30'}`} />
                      {Math.round(report.similarity_score * 100)}%
                    </span>
                  )}
                </div>
                {/* 제목: 풀텍스트, 줄바꿈 허용 */}
                <h1 className={`font-bold text-sm leading-snug break-words whitespace-normal ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {(report.title || '').replace(/^INC-[\w-]+\s*\|\s*/i, '')}
                </h1>
              </>
            ) : (
              <span className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>장애 보고서</span>
            )}
          </div>

          {/* 공유 버튼 + 툴팁 */}
          <div className="relative shrink-0">
            <button
              onClick={() => {
                setShowShareTooltip(true);
                setTimeout(() => setShowShareTooltip(false), 2500);
              }}
              className={`p-2 rounded-full transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <Share2 className="w-5 h-5" />
            </button>
            {showShareTooltip && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: isLight ? '#ffffff' : 'rgba(15,18,32,0.97)',
                backdropFilter: 'blur(12px)',
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12, padding: '10px 14px', minWidth: 180,
                boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.1)' : '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 200,
              }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#0f172a' : 'rgba(255,255,255,0.7)', marginBottom: 8 }}>공유 옵션</p>
                <button
                  onClick={() => { navigator.clipboard?.writeText(window.location.href); setShowShareTooltip(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '7px 8px', borderRadius: 8, border: 'none',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                    color: isLight ? '#334155' : '#94a3b8',
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
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)',
                    color: isLight ? '#334155' : '#94a3b8',
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
          <div className={`border-t py-1.5 px-2 ${isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-[#0d1220] border-white/5 shadow-inner'}`}>
            <div className="relative max-w-5xl mx-auto">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 py-1 pr-12 text-left">
                <span className={`skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-xs ${isLight ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'}`}>
                  <Clock size={13} /> {report.created_at?.slice(5, 16) || '05-15 11:41'}
                </span>
                
                <span className={`skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
                  <Users size={13} /> {report.who_name || report.creator_name || (report.who && String(report.who).startsWith('S') ? '조경훈' : report.who) || '조경훈'}
                </span>

                <span className={`skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-black flex items-center gap-1.5 shadow-xs ${isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                  <Activity size={13} /> MTTR {report.duration_label ?? (report.duration_min != null ? `${report.duration_min}분` : '51분')}
                </span>

                <span className={`skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                  <MessageSquare size={13} /> 채팅 {report.message_count || 0}
                </span>

                <span className={`skeuo-pill shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-xs ${isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                  <Paperclip size={13} /> 첨부 {report.attachment_count || 0}
                </span>
              </div>

              {/* 우측 스와이프 시각적 인디케이터 */}
              <div className={`absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l flex items-center justify-end pr-2 pointer-events-none z-10 animate-pulse ${isLight ? 'from-slate-100 via-slate-100/80 to-transparent' : 'from-[#0d1220] via-[#0d1220]/80 to-transparent'}`}>
                <div className={`p-1 rounded-full border shadow-sm flex items-center justify-center ${isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white/10 text-slate-300 border-white/20'}`}>
                  <ChevronRight size={14} className="stroke-[3]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </header>


      {/* Tabs with Horizontal Scroll Indicator */}
      <div className={`relative border-b shrink-0 ${isLight ? 'border-slate-200 bg-white' : 'border-white/5 bg-[#0a0d14]'}`}>
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
                  ? (isLight ? 'border-blue-600 text-blue-600 bg-blue-50/60' : 'border-blue-500 text-blue-400 bg-blue-500/5')
                  : (isLight ? 'border-transparent text-slate-500 hover:text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-300')
              }`}
            >
              {t.label}
              {activeTab === t.id && (
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${isLight ? 'bg-blue-600' : 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]'}`} />
              )}
            </button>
          ))}
        </div>

        {/* 🚀 우측 스크롤 인디케이터 (탭이 더 있음을 시각적으로 알림) */}
        {hasMoreTabs && (
          <div className={`absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l flex items-center justify-end pr-2 pointer-events-none z-10 animate-in fade-in duration-300 ${isLight ? 'from-white via-white/90 to-transparent' : 'from-[#0a0d14] via-[#0a0d14]/90 to-transparent'}`}>
            <div className={`p-1.5 rounded-full border animate-pulse flex items-center ${isLight ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-sm' : 'bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}>
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
            <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-4 ${isLight ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-blue-500/10 border-blue-500/20 shadow-[0_0_25px_rgba(59,130,246,0.15)]'}`}>
              <FileText className="w-8 h-8 text-blue-500 opacity-80" />
            </div>
            <h3 className={`text-base font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>아직 보고서가 생성되지 않았습니다</h3>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
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
                  <section className={`rounded-2xl overflow-visible transition-colors ${isLight ? 'bg-white border border-slate-200/90 shadow-sm' : 'bg-[#0f1421] border border-blue-500/10'}`}>
                    <div className={`px-4 py-2.5 flex items-center justify-between border-b ${isLight ? 'border-slate-100 bg-blue-50/60' : 'border-white/5 bg-blue-500/5'}`}>
                      <div className="flex items-center gap-2">
                        <Sparkles className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                        <span className={`text-xs font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>S-Autopilot Insight</span>
                      </div>
                      {report.similarity_score !== undefined && report.similarity_score !== null && (
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border shadow-xs ${isLight ? 'bg-blue-100/80 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5'}`}>
                          <Zap className={`w-3 h-3 ${isLight ? 'text-blue-600 fill-blue-600/20' : 'text-blue-400 fill-blue-400/20'}`} />
                          <span className={`text-[10px] font-black font-mono ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                            {Math.round(report.similarity_score * 100)}% Similarity
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      {report.similarity_reason && (
                        <div className={`mb-4 rounded-xl p-3 flex items-start gap-2.5 animate-in slide-in-from-top-1 duration-500 ${isLight ? 'bg-blue-50/80 border border-blue-200/80 shadow-xs' : 'bg-blue-500/5 border border-blue-500/10'}`}>
                          <div className={`mt-0.5 p-1.5 rounded-lg border shadow-xs ${isLight ? 'bg-blue-100 border-blue-200' : 'bg-blue-500/20 border-blue-500/20'}`}>
                            <Zap className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600 fill-blue-600/20' : 'text-blue-400 fill-blue-400/20'}`} />
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isLight ? 'text-blue-900' : 'text-blue-400/70'}`}>AI Matching Rationale</p>
                            <p className={`text-xs font-medium italic leading-relaxed ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
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
                  <section className={`rounded-2xl overflow-visible transition-colors ${isLight ? 'bg-white border border-slate-200/90 shadow-sm' : 'bg-[#0f1421] border border-amber-500/10'}`}>
                    <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${isLight ? 'border-slate-100 bg-amber-50/60' : 'border-white/5 bg-amber-50/5'}`}>
                      <Bot className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                      <span className={`text-xs font-bold ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>Leader Agent 종합 요약</span>
                    </div>
                    <div className="p-4">
                      <MarkdownBlock text={report.leader_summary} report={report} checkedItems={checkedActionItems} onToggleCheck={toggleActionItem} />
                    </div>
                  </section>
                )}

                {/* ── [NEW] War-Room Response Timeline (moved to main summary tab) ── */}
                {chatSummary && (
                  <section className={`rounded-2xl overflow-visible shadow-sm ${isLight ? 'bg-white border border-slate-200/90 shadow-slate-100' : 'bg-blue-600/5 border border-blue-500/20 shadow-blue-500/5'}`}>
                    <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${isLight ? 'border-slate-100 bg-blue-50/60' : 'border-blue-500/10 bg-blue-500/10'}`}>
                      <Sparkles className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                      <span className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>War-Room Response Timeline</span>
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
                  const agentStyles = getAgentColors(isLight);
                  const cfg = agentStyles[log.agent_role] || agentStyles.Leader;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-xl border p-4 shadow-xs ${cfg.bg}`}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Icon className={`w-4 h-4 ${cfg.text}`} />
                        <span className={`text-xs font-bold ${cfg.text}`}>{log.agent_role} Agent</span>
                        <span className={`ml-auto text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{log.reg_dt?.slice(0, 16)}</span>
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
                <section className={`rounded-2xl overflow-visible shadow-sm ${
                  isLight ? 'bg-white border border-slate-200 shadow-slate-100' : 'bg-blue-600/5 border border-blue-500/20 shadow-blue-500/5'
                }`}>
                  <div className={`px-4 py-2.5 flex items-center gap-2 border-b ${
                    isLight ? 'border-slate-100 bg-blue-50/60' : 'border-blue-500/10 bg-blue-500/10'
                  }`}>
                    <Sparkles className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>War-Room Response Timeline</span>
                  </div>
                  <div className="p-5 overflow-visible">
                    {chatSummary ? (() => {
                      // [HH:MM:SS] or [HH:MM] 등 패턴 (앞뒤 **나 공백 허용)
                      const raw = chatSummary;
                      const regex = /(?:\*\*)?\[(\d{2}:\d{2}(?::\d{2})?[^\]]*)\](?:\*\*)?\s*/g;
                      const items = [];
                      let match;
                      const timestamps = [];
                      while ((match = regex.exec(raw)) !== null) {
                        timestamps.push({ time: match[1], index: match.index, end: regex.lastIndex });
                      }
                      timestamps.forEach((ts, i) => {
                        const nextStart = timestamps[i + 1]?.index ?? raw.length;
                        let text = raw.slice(ts.end, nextStart).trim();
                        // 앞쪽 잔여 `:**` 보정 (e.g. `**[17:52:54] 라벨:**` 형태였을 경우)
                        text = text.replace(/^([^*:\n]{1,40}):\*\*\s*/, '**$1:** ');
                        // 앞뒤 잔여 마크다운 별표(*) 정리
                        text = text.replace(/^\*+|\*+$/g, '').trim();
                        if (text) items.push({ time: ts.time, text });
                      });
                      // 타임스탬프 없으면 fallback
                      if (items.length === 0) {
                        return <MarkdownBlock text={formatTimeline(chatSummary)} report={report} />;
                      }

                      const icons = ['🚨','📡','🔍','🛠️','✅','📋','🔔','💡'];
                      const colors = [
                        {
                          dot: isLight ? 'bg-red-600' : 'bg-red-500',
                          line: isLight ? 'bg-red-200' : 'bg-red-500/30',
                          badge: isLight ? 'bg-red-100 border-red-300 text-red-800' : 'bg-red-500/15 border-red-500/30 text-red-400',
                          card: isLight ? 'border-red-200 bg-red-50/40' : 'border-red-500/20 bg-red-500/5'
                        },
                        {
                          dot: isLight ? 'bg-orange-600' : 'bg-orange-400',
                          line: isLight ? 'bg-orange-200' : 'bg-orange-400/30',
                          badge: isLight ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-orange-500/15 border-orange-500/30 text-orange-400',
                          card: isLight ? 'border-orange-200 bg-orange-50/40' : 'border-orange-500/20 bg-orange-500/5'
                        },
                        {
                          dot: isLight ? 'bg-amber-600' : 'bg-yellow-400',
                          line: isLight ? 'bg-amber-200' : 'bg-yellow-400/30',
                          badge: isLight ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
                          card: isLight ? 'border-amber-200 bg-amber-50/40' : 'border-yellow-500/20 bg-yellow-500/5'
                        },
                        {
                          dot: isLight ? 'bg-blue-600' : 'bg-blue-500',
                          line: isLight ? 'bg-blue-200' : 'bg-blue-500/30',
                          badge: isLight ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-blue-500/15 border-blue-500/30 text-blue-400',
                          card: isLight ? 'border-blue-200 bg-blue-50/40' : 'border-blue-500/20 bg-blue-500/5'
                        },
                        {
                          dot: isLight ? 'bg-violet-600' : 'bg-violet-500',
                          line: isLight ? 'bg-violet-200' : 'bg-violet-500/30',
                          badge: isLight ? 'bg-violet-100 border-violet-300 text-violet-800' : 'bg-violet-500/15 border-violet-500/30 text-violet-400',
                          card: isLight ? 'border-violet-200 bg-violet-50/40' : 'border-violet-500/20 bg-violet-500/5'
                        },
                        {
                          dot: isLight ? 'bg-emerald-600' : 'bg-emerald-500',
                          line: isLight ? 'bg-emerald-200' : 'bg-emerald-500/30',
                          badge: isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                          card: isLight ? 'border-emerald-200 bg-emerald-50/40' : 'border-emerald-500/20 bg-emerald-500/5'
                        },
                        {
                          dot: isLight ? 'bg-cyan-600' : 'bg-cyan-500',
                          line: isLight ? 'bg-cyan-200' : 'bg-cyan-500/30',
                          badge: isLight ? 'bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
                          card: isLight ? 'border-cyan-200 bg-cyan-50/40' : 'border-cyan-500/20 bg-cyan-500/5'
                        },
                        {
                          dot: isLight ? 'bg-rose-600' : 'bg-pink-500',
                          line: isLight ? 'bg-rose-200' : 'bg-pink-500/30',
                          badge: isLight ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-pink-500/15 border-pink-500/30 text-pink-400',
                          card: isLight ? 'border-rose-200 bg-rose-50/40' : 'border-pink-500/20 bg-pink-500/5'
                        },
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
                                    style={{ borderColor: 'currentColor', boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.08)' : '0 0 12px rgba(0,0,0,0.3)' }}>
                                    <span style={{ fontSize: 14 }}>{icon}</span>
                                  </div>
                                  {!isLast && (
                                    <div className={`w-0.5 flex-1 min-h-[24px] mt-1 ${c.line}`} />
                                  )}
                                </div>
                                {/* 카드 */}
                                <div className={`flex-1 mb-5 rounded-2xl border p-4 ${c.card} transition-all hover:brightness-105`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[11px] font-black font-mono px-2.5 py-1 rounded-lg border ${c.badge}`}>
                                      {item.time}
                                    </span>
                                    <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                      STEP {idx + 1} / {items.length}
                                    </span>
                                    {isLast && (
                                      <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest ${
                                        isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                      }`}>
                                        완료
                                      </span>
                                    )}
                                  </div>
                                  <WarRoomStepContent text={item.text} isLight={isLight} isLast={isLast} />
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
                    className={`flex items-center gap-3 rounded-xl p-3 border transition-colors ${
                      isLight
                        ? 'bg-white border-slate-200 hover:border-blue-400 shadow-xs'
                        : 'bg-[#0f1421] border-white/5 hover:border-blue-500/30'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/15 border-blue-500/20'
                    }`}>
                      <Paperclip className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{att.original_name}</p>
                      <p className="text-[10px] text-slate-500">{att.uploaded_by} · {att.timestamp?.slice(0, 16)}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                      isLight ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    }`}>다운로드</span>
                  </a>
                ))}
              </div>
            )}

            {/* ── AI 종합보고서 ── */}
            {activeTab === 'ai_report' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {!aiGenText && !isGenerating && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                    <div style={{ width: 56, height: 56, borderRadius: 18, background: isLight ? 'rgba(37,99,235,0.08)' : 'rgba(59,130,246,0.1)', border: `1px solid ${isLight ? 'rgba(37,99,235,0.2)' : 'rgba(59,130,246,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles style={{ width: 26, height: 26, color: isLight ? '#2563eb' : '#60a5fa' }} />
                    </div>
                    <p className={`text-sm font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>데이터 분석을 바탕으로 종합 보고서를 생성합니다...</p>
                  </div>
                )}
                {isGenerating && !aiGenText && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                    <div style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
                    <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Dify AI 전문가 분석 진행 중...</p>
                  </div>
                )}
                {aiGenText && (
                  <section className={`rounded-2xl overflow-hidden transition-all shadow-xl ${
                    isLight
                      ? 'bg-white border border-slate-200 shadow-slate-200/60'
                      : 'bg-[#0b101d] border border-blue-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
                  }`}>
                    {/* 헤더 */}
                    <div className={`px-5 py-3.5 flex items-center justify-between border-b ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                          isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className={`text-sm font-black ${isLight ? 'text-blue-950' : 'text-blue-300'}`}>AI 종합 장애 보고서</p>
                          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Dify 전문가 멀티에이전트 분석 결과</p>
                        </div>
                        {isGenerating && (
                          <div className={`flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            isLight ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            <span>분석 중...</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={generateAiReport}
                        disabled={isGenerating}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          isLight
                            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-xs'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        } ${isGenerating ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                        재생성
                      </button>
                    </div>

                    {/* 본문 */}
                    <div className={`p-6 sm:p-8 min-h-[400px] ${isLight ? 'bg-white text-slate-900' : 'bg-[#0b101d] text-slate-100'}`}>
                      <MarkdownBlock text={aiGenText} report={report} />
                      {isGenerating && (
                        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-1 align-middle rounded" />
                      )}
                    </div>

                    {/* 푸터 */}
                    {!isGenerating && (
                      <div className={`px-5 py-3 border-t flex items-center justify-between text-[11px] ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-black/20 border-white/5 text-slate-500'
                      }`}>
                        <span>S-Guard AI · Dify 전문가 분석</span>
                        <span>{new Date().toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
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
          <div className={`relative z-10 w-full max-w-2xl rounded-t-3xl border overflow-visible max-h-[90vh] flex flex-col ${
            isLight ? 'bg-white border-slate-200 shadow-2xl' : 'bg-[#0f1219] border-white/10'
          }`}>
            <div className={`p-5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {modalStep === 'preview' ? '📋 보고서 최종 확인' : '📤 보고 대상 선정'}
              </h3>
              <button onClick={() => setModalStep(null)} className={`p-1.5 rounded-full ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'}`}>
                <X className="w-4 h-4" />
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
                    <div key={k} className={`rounded-xl p-3 border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#161b24] border-white/5'}`}>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">{k}</span>
                      <p className={`mt-0.5 text-xs break-words ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>{v || '-'}</p>
                    </div>
                  ))}
                  {memo && <div className={`rounded-xl p-3 border text-xs italic ${isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-500/10 border-blue-500/20 text-blue-200'}`}>"{memo}"</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  {reportingLines.map(line => (
                    <div
                      key={line.id}
                      onClick={() => toggleLine(line.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedLines.includes(line.id)
                          ? (isLight ? 'bg-blue-50 border-blue-500 shadow-xs' : 'bg-blue-600/10 border-blue-500')
                          : (isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-[#161b2a]/50 border-white/5')
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          selectedLines.includes(line.id) ? 'bg-blue-600 text-white' : (isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400')
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{line.role} {line.name}</p>
                          <p className="text-[10px] text-slate-500">{line.desc}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedLines.includes(line.id) ? 'bg-blue-600 border-blue-400' : (isLight ? 'border-slate-300' : 'border-slate-600')
                      }`}>
                        {selectedLines.includes(line.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`p-4 border-t flex gap-3 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
              <button
                onClick={() => modalStep === 'preview' ? setModalStep(null) : setModalStep('preview')}
                className={`flex-1 h-12 rounded-2xl text-sm font-bold transition-all border ${
                  isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-white/5'
                }`}
              >
                {modalStep === 'preview' ? '닫기' : '이전'}
              </button>
              <button
                onClick={() => modalStep === 'preview' ? setModalStep('selection') : (selectedLines.length > 0 && handleFinalSubmit())}
                disabled={modalStep === 'selection' && selectedLines.length === 0}
                className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
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
