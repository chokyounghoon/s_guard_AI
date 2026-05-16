import React, { useState } from 'react';
import { Copy, Share2, Sparkles, CheckCircle, ThumbsUp, ThumbsDown, MessageSquare, AlertCircle, X, ChevronRight } from 'lucide-react';
import { getAccessToken } from '../lib/authStore';

export default function AIChatBubble({ message, query, incidentId, onCopy, onShare }) {
  const [feedback, setFeedback] = useState(null); // 'UP', 'DOWN'
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [downReason, setDownReason] = useState('');
  const [correction, setCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (message.text == null && (!message.logs || message.logs.length === 0) && !message.metrics) {
    return null;
  }

  const handleFeedback = async (type, detail = null) => {
    setFeedback(type);
    if (type === 'DOWN' && !detail) {
      setShowFeedbackModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = getAccessToken();
      const res = await fetch('https://sguardai.khcho0421.workers.dev/ai/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inc_id: incidentId || message.incident_id,
          query: query || message.query || "질문 정보 없음",
          answer: message.text,
          context: message.logs || [],
          feedback_type: type,
          reason: detail?.reason || null,
          user_correction: detail?.correction || null,
          user_id: (() => { try { return JSON.parse(localStorage.getItem('sguard_user') || '{}').employee_id || ''; } catch { return ''; } })()
        })
      });
      if (res.ok) {
        if (type === 'UP') alert('피드백이 반영되었습니다. 감사합니다!');
      }
    } catch (e) {
      console.error("Feedback failed", e);
    } finally {
      setIsSubmitting(false);
      setShowFeedbackModal(false);
    }
  };

  const formatTimestamp = () => {
    const date = new Date();
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const parseMarkdown = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let codeBlock = null;
    let codeLines = [];
    let tableRows = [];

    const flushTable = (keySuffix) => {
      if (tableRows.length === 0) return null;
      const validRows = tableRows.filter(r => !r.replace(/\|/g, '').trim().match(/^[-: ]+$/));
      if (validRows.length > 0) {
        const headerCols = validRows[0].split('|').map(c => c.trim()).filter(Boolean);
        const bodyRows = validRows.slice(1).map(row => row.split('|').map(c => c.trim()).filter(Boolean));

        const cleanCol = (colStr) => colStr.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*\*/g, '');

        const tableElem = (
          <div key={`table-${keySuffix}`} className="my-3 overflow-x-auto rounded-xl border border-purple-500/20 bg-[#0d1017] shadow-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/80 border-b border-purple-500/20">
                  {headerCols.map((col, cIdx) => (
                    <th key={cIdx} className="px-3.5 py-2.5 font-bold text-purple-300 tracking-wider uppercase text-[11px]">
                      {cleanCol(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300 font-medium">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-white/[0.03] transition-colors">
                    {row.map((col, cIdx) => (
                      <td key={cIdx} className={`px-3.5 py-2.5 ${cIdx === 0 ? 'font-bold text-white/95 bg-white/[0.02]' : ''}`}>
                        {cleanCol(col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        return tableElem;
      }
      tableRows = [];
      return null;
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('```')) {
        if (tableRows.length > 0) {
          const tElem = flushTable(idx);
          if (tElem) elements.push(tElem);
        }
        if (codeBlock === null) {
          codeBlock = trimmed.replace('```', '').trim();
        } else {
          elements.push(
            <div key={`code-${idx}`} className="bg-[#0d0f14] border border-blue-500/20 rounded-xl p-4 my-3 font-mono text-xs overflow-x-auto shadow-md">
              <div className="text-blue-400 text-[10px] mb-2 font-bold uppercase tracking-wider">{codeBlock || 'Code'}</div>
              {codeLines.map((codeLine, i) => (
                <div key={i} className="text-slate-300 leading-relaxed">{codeLine}</div>
              ))}
            </div>
          );
          codeBlock = null;
          codeLines = [];
        }
        return;
      }
      if (codeBlock !== null) {
        codeLines.push(line);
        return;
      }

      // 테이블 문법 처리
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        tableRows.push(trimmed);
        return;
      } else if (tableRows.length > 0) {
        const tElem = flushTable(idx);
        if (tElem) elements.push(tElem);
      }

      // 헤딩 (###, #### 등) 처리
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^#+/);
        if (!match) return;
        const level = match[0].length;
        let title = trimmed.replace(/^#+\s*/, '').trim();
        title = title.replace(/\[(.+?)\]/g, '$1'); // 대괄호 벗기기

        if (level <= 3) {
          elements.push(
            <div key={idx} className="text-[14px] font-black text-purple-200 border-b border-purple-500/30 pb-1.5 mt-4 mb-2.5 flex items-center gap-2">
              <Sparkles size={15} className="text-purple-400 shrink-0" />
              <span className="tracking-wide">{title}</span>
            </div>
          );
        } else {
          elements.push(
            <div key={idx} className="text-xs font-bold text-blue-300 mt-3 mb-1.5 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 inline-block tracking-tight">
              {title}
            </div>
          );
        }
        return;
      }

      if (!trimmed) {
        elements.push(<div key={idx} className="h-1.5" />);
        return;
      }

      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const rawText = trimmed.replace(/^[\*\-]\s*/, '');
        const parts = rawText.split(':');
        let contentHtml = rawText;
        if (parts.length > 1 && parts[0].length < 35) {
          const cleanTitle = parts[0].replace(/\*\*/g, '').trim();
          const boldTitle = `<strong class="font-bold text-purple-200">${cleanTitle}:</strong>`;
          const remaining = parts.slice(1).join(':').replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>').replace(/\*\*/g, '');
          contentHtml = boldTitle + remaining;
        } else {
          contentHtml = rawText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>').replace(/\*\*/g, '');
        }

        elements.push(
          <div key={idx} className="flex items-start space-x-2 my-1.5 text-[13px] text-slate-200">
            <span className="text-purple-400 mt-0.5 shrink-0 text-xs">•</span>
            <span className="leading-relaxed flex-1" dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </div>
        );
      } else {
        let processed = trimmed;
        processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>').replace(/\*\*/g, '');
        elements.push(
          <p key={idx} className="my-1.5 leading-relaxed text-[13px] text-slate-200 break-words font-normal" dangerouslySetInnerHTML={{ __html: processed }} />
        );
      }
    });

    if (tableRows.length > 0) {
      const tElem = flushTable('end');
      if (tElem) elements.push(tElem);
    }

    return elements;
  };

  return (
    <div className="flex items-start space-x-3 animate-in fade-in slide-in-from-left-4 duration-300 relative">
      {/* AI Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-purple-900/40">
        <Sparkles className="w-5 h-5 text-white" />
      </div>

      <div className="flex flex-col space-y-2 max-w-[85%]">
        {/* AI Name Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-purple-400 font-bold">S-Autopilot AI</span>
            <span className="text-[9px] text-slate-500 font-mono">{formatTimestamp()}</span>
          </div>
        </div>

        {/* Message Bubble */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-purple-500/20 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur-sm">
          {parseMarkdown(message.text)}

          {/* Related Logs / Knowledge Base Context */}
          {message.logs && message.logs.length > 0 && (
            <div className="mt-4 pt-3 border-t border-purple-500/20">
              <div className="bg-[#0b0d12] rounded-xl border border-white/5 p-3 text-[11px] font-mono overflow-auto max-h-48">
                <div className="flex items-center space-x-1.5 mb-2 text-purple-400 border-b border-white/5 pb-1">
                  <Sparkles className="w-3 h-3" />
                  <span className="font-semibold tracking-wide">RAG 검토 지식 (Knowledge Base)</span>
                </div>
                <div className="space-y-2">
                  {message.logs.map((log, logIdx) => (
                    <div key={logIdx} className="text-slate-300 border-l-2 border-purple-500/30 pl-2 py-0.5 whitespace-pre-wrap leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metrics & Confidence remains the same... */}
          {message.metrics && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
              <MetricCard label="CPU" value={message.metrics.cpu} unit="%" color="blue" />
              <MetricCard label="Memory" value={message.metrics.memory} unit="%" color="purple" />
              <MetricCard label="Response" value={message.metrics.responseTime} unit="ms" color="cyan" />
            </div>
          )}
          {message.confidence && (
            <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/10">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">신뢰도 {message.confidence}%</span>
            </div>
          )}
        </div>

        {/* Action Buttons & Feedback Loop */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onCopy && onCopy(message.text)}
              className="px-2 py-1 bg-slate-800/40 hover:bg-slate-700 border border-white/5 rounded-lg text-[10px] text-slate-400 transition-all flex items-center space-x-1"
            >
              <Copy className="w-3 h-3" />
              <span>복사</span>
            </button>
            <button
              onClick={() => onShare && onShare(message.text)}
              className="px-2 py-1 bg-slate-800/40 hover:bg-slate-700 border border-white/5 rounded-lg text-[10px] text-slate-400 transition-all flex items-center space-x-1"
            >
              <Share2 className="w-3 h-3" />
              <span>공유</span>
            </button>
          </div>

          {/* 👍/👎 Feedback Loop UI */}
          <div className="flex items-center bg-slate-800/30 border border-white/5 rounded-lg px-1.5 py-0.5 space-x-1">
            <button
              onClick={() => handleFeedback('UP')}
              disabled={feedback === 'UP'}
              className={`p-1 rounded-md transition-all ${feedback === 'UP' ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-blue-400 hover:bg-white/5'}`}
              title="도움이 되었어요"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${feedback === 'UP' ? 'fill-current' : ''}`} />
            </button>
            <div className="w-px h-3 bg-white/10 mx-0.5"></div>
            <button
              onClick={() => handleFeedback('DOWN')}
              disabled={feedback === 'DOWN' && !showFeedbackModal}
              className={`p-1 rounded-md transition-all ${feedback === 'DOWN' ? 'text-red-400 bg-red-500/10' : 'text-slate-500 hover:text-red-400 hover:bg-white/5'}`}
              title="상세 피드백 남기기"
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${feedback === 'DOWN' ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Feedback Modal (Popup) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">무엇이 잘못되었나요?</h3>
              </div>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                {['정보가 오래됨', 'SMS 내역과 불일치', '관련 없는 답변', '기타 (직접 입력)'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setDownReason(reason)}
                    className={`text-left px-3 py-2.5 rounded-xl text-xs transition-all border ${downReason === reason ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'}`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">교정 내용 (직접 수정)</label>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="올바른 정답이나 수정 사항을 입력해 주세요..."
                  className="w-full h-24 bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                />
              </div>

              <button
                onClick={() => handleFeedback('DOWN', { reason: downReason, correction })}
                disabled={!downReason || isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? <span>제출 중...</span> : (
                  <>
                    <span>피드백 제출하기</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, unit, color }) {
  const getColorClasses = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-900/30 border-blue-500/30 text-blue-400';
      case 'purple': return 'bg-purple-900/30 border-purple-500/30 text-purple-400';
      case 'cyan': return 'bg-cyan-900/30 border-cyan-500/30 text-cyan-400';
      default: return 'bg-slate-900/30 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className={`border rounded-lg p-2 text-center ${getColorClasses(color)}`}>
      <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-70">{label}</div>
      <div className="text-sm font-bold">
        {value}<span className="text-[10px] ml-0.5">{unit}</span>
      </div>
    </div>
  );
}
