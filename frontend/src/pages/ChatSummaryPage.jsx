import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  CheckCircle,
  CheckCircle2,
  RefreshCw,
  Activity,
  ListChecks,
  PlusCircle,
  TrendingUp,
  Info,
  Sparkles,
  Clock,
  AlertCircle,
  Shield,
  Printer,
  History,
  BookMarked,
  Database,
  Zap,
  Send,
  User,
  X,
  ChevronRight,
  Brain
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import html2pdf from 'html2pdf.js';
import BottomMenu from '../components/BottomMenu';

export default function ChatSummaryPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [modalStep, setModalStep] = useState(null); // 'selection' or null
  const [selectedLines, setSelectedLines] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('');
  
  const abortControllerRef = useRef(null);
  const [loadingStatus, setLoadingStatus] = useState('Dify AI 엔진에 분석을 요청하고 있습니다...');
  const [governanceStep, setGovernanceStep] = useState(null); // null, 'knowledge', 'resolving', 'done'

  const [reportingLines, setReportingLines] = useState([]);
  const [incidentMessage, setIncidentMessage] = useState('');     // 장애 SMS 문자 내용
  const [workflowSteps, setWorkflowSteps] = useState([]);          // 장애처리현황 단계

  const getApiUrl = (endpoint) => {
    // 🚀 AI 분석/요약 엔진은 로컬 백엔드 대신 배포된 Worker를 직접 사용한다 (안정성 확보)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // DB 동기화가 필요한 특정 API만 로컬 백엔드 이용
    if (isLocalDev && endpoint.startsWith('/api/v1/db-sync')) {
      return `http://127.0.0.1:8000${endpoint}`;
    }
    
    const workerBase = 'https://sguardai.khcho0421.workers.dev';
    return `${workerBase}${endpoint}`;
  };

  useEffect(() => {
    const fetchSummary = async () => {
      setIsLoading(true);
      setIsStreaming(true);
      setError(null);
      setSummary('');
      let currentController;
      try {
        currentController = new AbortController();
        abortControllerRef.current = currentController;

        const response = await fetch(getApiUrl('/ai/summarize-chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id: incidentId }),
          signal: currentController.signal
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to fetch summary');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evt of events) {
            const lines = evt.split('\n');
            for (const line of lines) {
              if (!line.trim().startsWith('data:')) continue;
              const dataStr = line.replace(/^data:\s*/, '').trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.status) {
                  setLoadingStatus(data.status);
                }
                if (data.answer) {
                  setSummary(prev => {
                    const newText = prev + data.answer;
                    // Auto-hide overall loader once we actually have some readable text!
                    if (newText.length > 5 && isLoading) {
                      setIsLoading(false);
                    }
                    return newText;
                  });
                }
                if (data.error) {
                  setError(data.error);
                }
              } catch (e) {
                console.error('Error parsing SSE data', e, 'DataStr:', dataStr);
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Summary fetch error:', err);
          setError('요약 생성 중 오류가 발생했습니다.');
        }
      } finally {
        // Prevent aborted fetches in Strict Mode from resetting the active stream state
        if (abortControllerRef.current === currentController) {
          setIsLoading(false);
          setIsStreaming(false);
        }
      }
    };

    fetchSummary();

    // Fetch Personalized Reporting Lines
    const fetchReportLines = async () => {
      const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
      if (!savedUser.employee_id) return;
      
      try {
        const res = await fetch(getApiUrl(`/api/v1/report-lines?user_id=${savedUser.employee_id}`));
        if (res.ok) {
          const data = await res.json();
          if (data.report_lines?.length > 0) {
            setReportingLines(data.report_lines.map(line => ({
              id: line.user_id,
              role: line.role_name,
              name: line.user_name,
              desc: `${line.role_name} 결재자`
            })));
          } else {
            // Default if none set
            setReportingLines([
              { id: 'system-default', role: '시스템', name: '관리자', desc: '기본 보고 대상' }
            ]);
          }
        }
      } catch (e) {
        console.error("Failed to fetch custom report lines:", e);
      }
    };
    fetchReportLines();

    // Fetch Incident Metadata (Status)
    const fetchIncidentStatus = async () => {
      try {
        const res = await fetch(getApiUrl(`/ai/incident/${incidentId.startsWith('INC-') ? incidentId : `INC-${incidentId}`}`));
        if (res.ok) {
          const data = await res.json();
          if (data.incident) {
            setIncidentStatus(data.incident.status);
            // If already completed, set govSuccess to true to show the 'Checked' state
            if (data.incident.status === '처리완료') {
              setGovSuccess(true);
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch incident status:", e);
      }
    };
    fetchIncidentStatus();

    // Fetch Incident SMS Message & Workflow Steps
    const fetchIncidentData = async () => {
      try {
        const cleanId = incidentId.startsWith('INC-') ? incidentId : `INC-${incidentId}`;
        const res = await fetch(getApiUrl(`/ai/incident/${cleanId}`));
        if (res.ok) {
          const data = await res.json();
          const inc = data.incident;
          // 우선순위: sms_message(received_messages JOIN) > title에 포함된 SMS > description
          if (inc?.sms_message) {
            setIncidentMessage(inc.sms_message);
          } else if (inc?.title && inc.title.includes(' | ')) {
            setIncidentMessage(inc.title.split(' | ').slice(1).join(' | '));
          } else if (inc?.description) {
            setIncidentMessage(inc.description);
          }
        }
      } catch (e) { console.error('Failed to fetch incident message:', e); }

      try {
        const res = await fetch(getApiUrl(`/ai/incident/workflow-details?inc_id=${incidentId}`));
        if (res.ok) {
          const data = await res.json();
          setWorkflowSteps(data.steps || []);
        }
      } catch (e) { console.error('Failed to fetch workflow steps:', e); }
    };
    fetchIncidentData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [incidentId]);

  // 🧪 Section Parser Logic
  const parseSections = (text) => {
    if (!text) return [];

    // ✂️ Only start data from the "⏱️ 장애 대응 타임라인 요약" marker if it exists
    const marker = "⏱️ 장애 대응 타임라인 요약";
    const markerIndex = text.indexOf(marker);
    let cleanTextForParsing = text;
    if (markerIndex !== -1) {
      cleanTextForParsing = text.substring(markerIndex + marker.length).trim();
    }

    // Split by markdown headers like ### 1. Title or ### Title
    const parts = cleanTextForParsing.split(/###\s*(?:\d+\.?)?\s*/).filter(p => p.trim());
    
    // Map of section titles to icons and colors
    const sectionConfig = {
      '장애 개요': { icon: Info, color: 'from-blue-600 to-blue-400' },
      '주요 조치 사항': { icon: ListChecks, color: 'from-indigo-600 to-indigo-400' },
      '최종 결과': { icon: CheckCircle, color: 'from-emerald-600 to-emerald-400' },
      '향후 과제': { icon: TrendingUp, color: 'from-purple-600 to-purple-400' },
      '타임라인': { icon: History, color: 'from-blue-500 to-cyan-400' },
      'Default': { icon: Zap, color: 'from-slate-600 to-slate-400' }
    };

    // 🕐 타임라인 텍스트를 마크다운 리스트 형식으로 변환
    // 예: "[12:19:37] 장애 인지: ..." → "- [12:19:37] 장애 인지: ..."
    const convertToTimeline = (content) => {
      // 이미 리스트 형식이면 그대로
      if (/^\s*[-*]\s*\[\d/.test(content)) return content;
      // 인라인 타임스탬프를 개별 리스트 아이템으로 분리
      return content
        .replace(/([^\n])\s*(\[\d{1,2}:\d{2}(?::\d{2})?\])/g, '\n$2')  // 앞 텍스트와 분리
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '';
          if (/^\[\d{1,2}:\d{2}/.test(trimmed)) return `- ${trimmed}`;
          return trimmed;
        })
        .filter(Boolean)
        .join('\n');
    };

    if (parts.length <= 1 && !cleanTextForParsing.includes('###')) {
      if (isLoading) return []; 
      const isTimeline = /\[\d{1,2}:\d{2}/.test(cleanTextForParsing);
      const processedContent = isTimeline ? convertToTimeline(cleanTextForParsing) : cleanTextForParsing;
      return [{ title: isTimeline ? '장애 대응 타임라인 요약' : '인시던트 상세 요약', content: processedContent, icon: isTimeline ? History : FileText, color: 'from-blue-500 to-cyan-400' }];
    }

    return parts.map(part => {
      const lines = part.split('\n');
      const title = lines[0].trim().replace(/^\d+\.?\s*/, '');
      let content = lines.slice(1).join('\n').trim();
      
      // 타임라인 섹션이면 리스트 형식 변환
      const isTimeline = title.includes('타임라인') || /\[\d{1,2}:\d{2}/.test(content.substring(0, 200));
      if (isTimeline) content = convertToTimeline(content);

      // Try to find matching config or use default
      const config = Object.entries(sectionConfig).find(([key]) => title.includes(key))?.[1] || sectionConfig.Default;
      
      return { title, content, ...config };
    });
  };

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSendEmail = async () => {
    if (isSending || !summary) return;
    setIsSending(true);
    setSendSuccess(false);

    let styleElement = null;
    try {
      const reportElement = document.getElementById('report-content');
      if (!reportElement) throw new Error('Report container (report-content) not found');

      // 🛡️ OKLCH Nuclear Option: Inject a global override stylesheet
      styleElement = document.createElement("style");
      styleElement.id = "s-guard-pdf-override";
      styleElement.innerText = `
        /* Force standard color space for ALL elements in the report area during capture */
        #report-content, #report-content *, #report-content *::before, #report-content *::after {
          /* Neutralize oklch variables by forcing HEX equivalents */
          --color-slate-50: #f8fafc !important; --color-slate-100: #f1f5f9 !important; --color-slate-200: #e2e8f0 !important;
          --color-slate-300: #cbd5e1 !important; --color-slate-400: #94a3b8 !important; --color-slate-500: #64748b !important;
          --color-slate-600: #475569 !important; --color-slate-700: #334155 !important; --color-slate-800: #1e293b !important;
          --color-slate-900: #0f172a !important; --color-slate-950: #020617 !important;
          
          --color-blue-300: #93c5fd !important; --color-blue-400: #60a5fa !important; --color-blue-500: #3b82f6 !important; --color-blue-600: #2563eb !important;
          --color-indigo-400: #818cf8 !important; --color-indigo-500: #6366f1 !important; --color-indigo-600: #4f46e5 !important;
          
          --color-emerald-400: #34d399 !important; --color-emerald-500: #10b981 !important;
          --color-amber-400: #fbbf24 !important; --color-amber-500: #f59e0b !important;
          --color-red-400: #f87171 !important; --color-red-500: #ef4444 !important;
          --color-purple-400: #c084fc !important; --color-purple-500: #a855f7 !important;

          /* Prose Variable Neutralization */
          --tw-prose-body: #d1d5db !important; --tw-prose-headings: #ffffff !important;
          --tw-prose-links: #60a5fa !important; --tw-prose-bold: #ffffff !important;
          --tw-prose-counters: #94a3b8 !important; --tw-prose-bullets: #3b82f6 !important;
          --tw-prose-hr: #1e293b !important; --tw-prose-quote-borders: #3b82f6 !important;
          --tw-prose-code: #ffffff !important; --tw-prose-pre-bg: #0f172a !important;
          --tw-prose-th-borders: #1e293b !important; --tw-prose-td-borders: #111827 !important;

          /* Atomic class & Direct oklch neutralization */
          background-image: none !important; /* Remove potentially crashing gradients */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Specific known crashing points & HEX Fallbacks */
        .text-blue-400 { color: #60a5fa !important; }
        .text-emerald-400 { color: #34d399 !important; }
        .border-white\\/10 { border-color: #1e293b !important; }
        .bg-white\\/5 { background-color: #0f172a !important; }
        .bg-blue-600 { background-color: #2563eb !important; }
      `;
      document.head.appendChild(styleElement);

      const opt = {
        margin: 5,
        filename: `SGuard_Report_${incidentId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#1a1f2e',
          logging: false,
          onclone: (clonedDoc) => {
            // 🛡️ Global Style Sanitization: Fix for "Unsupported color function oklch"
            // 1. Sanitize all <style> tags in the head
            const styleTags = clonedDoc.getElementsByTagName('style');
            for (let i = 0; i < styleTags.length; i++) {
              const tag = styleTags[i];
              if (tag.textContent && (tag.textContent.includes('oklch') || tag.textContent.includes('oklab'))) {
                // Aggressively replace oklch(...) and oklab(...) with a safe hex value
                tag.textContent = tag.textContent.replace(/(oklch|oklab)\([^)]+\)/g, '#cbd5e1');
              }
            }

            // 2. Aggressive stripping from all individual elements
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(el => {
              const inlineStyle = el.getAttribute('style');
              if (inlineStyle && (inlineStyle.includes('oklch') || inlineStyle.includes('oklab'))) {
                // Remove the offending style or replace with safe fallback
                el.setAttribute('style', inlineStyle.replace(/(oklch|oklab)\([^)]+\)/g, '#cbd5e1'));
              }
            });
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Create PDF as blob
      const pdfBlob = await html2pdf().set(opt).from(reportElement).output('blob');

      // 🧹 Clean up the override stylesheet
      if (styleElement && styleElement.parentNode) {
        document.head.removeChild(styleElement);
        styleElement = null;
      }

      // 2. Prepare FormData and Send with Auth Header
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'report.pdf');
      formData.append('incident_id', incidentId);

      const res = await fetch(getApiUrl('/ai/send-report-email'), {
        method: 'POST',
        headers: { 
          'X-SGuard-Auth': 'my-secret-key'
        },
        body: formData
      });
      
      if (res.ok) {
        setSendSuccess(true);
        alert('팀장님께 전송 완료하였습니다.');
        setTimeout(() => setSendSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(`전송 실패: ${err.error || '접근이 거부되었습니다.'}`);
      }
    } catch (err) {
      console.error('PDF Email send error:', err);
      // Ensure cleanup even on error
      if (styleElement && styleElement.parentNode) {
        document.head.removeChild(styleElement);
      }
      alert(`보고서 생성 오류: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const [isGoverning, setIsGoverning] = useState(false);
  const [govSuccess, setGovSuccess] = useState(false);

  const handleGovernance = async () => {
    if (!summary || isGoverning) return;

    // 1. Validation for "Other Actions" (그외 처리 사항)
    if (!additionalNotes.trim()) {
      const isConfirmed = window.confirm(
        "더 등록할 내용이 없는지 확인해주세요.\n해당 war-room의 내용이 지식화되며 장애처리가 완료됩니다."
      );
      if (!isConfirmed) return;
    }

    const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
    if (!savedUser.employee_id) {
      alert("로그인 정보가 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setIsGoverning(true);
    setGovernanceStep('knowledge');
    
    const fullContent = `${summary}\n\n### [그외 처리 사항]\n${additionalNotes || '없음'}`;

    try {
      // Step 1: Call Consolidated Submission & Distribution API
      const response = await fetch(getApiUrl('/api/v1/reports/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId,
          sender_id: savedUser.employee_id,
          sender_name: savedUser.name || savedUser.employee_id,
          title: `[인시던트 보고서] ${incidentId}: ${summary.split('\n')[0].substring(0, 50)}...`,
          content: fullContent,
          preview: `장애 대응 완료 보고서 (${incidentId})`
        })
      });
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '보고서 제출 및 배부 실패');
      }
      
      setGovSuccess(true);
      setGovernanceStep('done');
      setIncidentStatus('처리완료');
      
      const supMsg = result.recipient_count > 0 
        ? `\n\n[보고 전송 완료]: ${result.superiors.join(', ')}`
        : "\n\n(설정된 보고 라인이 없어 전송되지 않았습니다.)";
        
      alert(`지식화 및 장애 처리가 성공적으로 완료되었습니다.${supMsg}\n\n인시던트 상태가 '처리완료'로 업데이트되었습니다.`);
      
      // Final Step: Redirect to Dashboard
      navigate('/dashboard');
      
    } catch (err) {
      console.error('Resolution error:', err);
      alert(`처리 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsGoverning(false);
      if (incidentStatus !== '처리완료') setGovernanceStep(null);
    }
  };

  const toggleLine = (id) => {
    setSelectedLines(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans pb-28">
      {/* Header - Mobile Optimized */}
      <header className="fixed top-0 left-0 right-0 bg-[#0f1421]/90 backdrop-blur-md border-b border-white/5 z-50 print:hidden">
        <div className="flex items-center gap-2 px-3 py-3">
          {/* 뒤로 + 제목 */}
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-95 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xs font-black tracking-wider uppercase text-blue-400 truncate">War-Room Report</h1>
            <p className="text-[9px] text-slate-500 font-mono truncate">{incidentId}</p>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 재분석 버튼 */}
            <button
              onClick={() => {
                setSummary('');
                setError(null);
                setIsLoading(true);
                setIsStreaming(true);
                setLoadingStatus('Dify AI 엔진에 재분석을 요청하고 있습니다...');
                // fetchSummary 재호출 (useEffect 트리거)
                const controller = new AbortController();
                abortControllerRef.current = controller;
                (async () => {
                  try {
                    const response = await fetch(getApiUrl('/ai/summarize-chat'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ incident_id: incidentId }),
                      signal: controller.signal
                    });
                    if (!response.ok || !response.body) throw new Error('재분석 요청 실패');
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    while (true) {
                      const { value, done } = await reader.read();
                      if (done) break;
                      buffer += decoder.decode(value, { stream: true });
                      const events = buffer.split('\n\n');
                      buffer = events.pop() || '';
                      for (const evt of events) {
                        for (const line of evt.split('\n')) {
                          if (!line.trim().startsWith('data:')) continue;
                          const dataStr = line.replace(/^data:\s*/, '').trim();
                          if (dataStr === '[DONE]') continue;
                          try {
                            const data = JSON.parse(dataStr);
                            if (data.status) setLoadingStatus(data.status);
                            if (data.answer) setSummary(prev => { const t = prev + data.answer; if (t.length > 5) setIsLoading(false); return t; });
                            if (data.error) setError(data.error);
                          } catch {}
                        }
                      }
                    }
                  } catch (err) {
                    if (err.name !== 'AbortError') setError('재분석 중 오류가 발생했습니다.');
                  } finally {
                    setIsLoading(false);
                    setIsStreaming(false);
                  }
                })();
              }}
              disabled={isLoading || isStreaming || isGoverning || govSuccess}
              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/10 hover:border-indigo-500/30 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="재분석 (Dify 재호출)"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isStreaming ? 'animate-spin text-indigo-400' : 'text-slate-300'}`} />
            </button>

            {/* Copy - 아이콘만 */}
            <button onClick={handleCopy} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all active:scale-95" title={isCopied ? 'Copied' : 'Copy'}>
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* 지식화/완료 처리 */}
            <button
              onClick={handleGovernance}
              disabled={isGoverning || isStreaming || isLoading || !summary || govSuccess || incidentStatus === '처리완료'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-black transition-all border active:scale-95 ${
                (govSuccess || incidentStatus === '처리완료')
                  ? 'bg-emerald-600/80 border-emerald-500/40 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-400/30 text-white hover:opacity-90'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isGoverning ? (
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : govSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Shield className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {isGoverning ? '처리 중...' : (govSuccess || incidentStatus === '처리완료') ? '완료됨' : '지식화/장애/보고/완료 처리'}
              </span>
              <span className="sm:hidden">
                {isGoverning ? '...' : (govSuccess || incidentStatus === '처리완료') ? '완료' : '완료 처리'}
              </span>
            </button>

            {/* Print - 아이콘만 */}
            <button onClick={handlePrint} className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-all active:scale-95" title="Print Report">
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 px-3 sm:px-6 max-w-4xl mx-auto">
        {/* Report Cover Style Component */}
        <div id="report-content" className="bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-6 print:shadow-none print:border-slate-200">
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="p-4 sm:p-8">
            {/* Cover: 타이틀 */}
            <div className="flex justify-between items-start mb-5">
              <div className="space-y-2">
                <div className="bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">AI-Generated Timeline</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-black leading-tight uppercase tracking-tight">
                  장애 대응
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Collaborative Timeline</span>
                </h2>
              </div>
              <FileText className="w-8 h-8 text-slate-700 shrink-0 mt-1" />
            </div>

            {/* Metadata Grid - 2열 모바일 */}
            <div className="grid grid-cols-2 gap-3 p-3 sm:p-5 bg-white/[0.02] rounded-xl border border-white/5 mb-4">
              <div className="col-span-2 space-y-1">
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Incident ID</div>
                <div className="text-xs font-black text-blue-400 font-mono">
                  {incidentId.replace(/^INC-/i, '')}
                </div>
                {/* 장애 SMS 문자 내용 (API 우선, 없으면 summary fallback) */}
                <div className="text-[11px] text-slate-400 leading-relaxed mt-1 line-clamp-3">
                  {incidentMessage
                    ? incidentMessage
                    : summary
                      ? summary.replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '').replace(/\n+/g, ' ').trim()
                      : '장애 메시지 로딩 중...'}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Summary Date</div>
                <div className="text-xs font-bold text-white">
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' '}{new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Report Status</div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold flex items-center gap-1 ${isLoading ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`}>
                    {isLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    {isLoading ? '분석 중...' : 'Verified'}
                  </span>
                  {!isLoading && (
                    <button onClick={() => { setSummary(''); window.location.reload(); }} className="p-0.5 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-all">
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Confidentiality</div>
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-500/70" />
                  <span className="text-xs text-amber-500/70 font-bold uppercase">Restricted</span>
                </div>
              </div>
            </div>

            {/* 장애처리현황 - 4단계 MTTR (일시분초) */}
            {workflowSteps.length > 0 && (() => {
              const smsStep = workflowSteps.find(s => s.id === 'SMS');
              const ragStep = workflowSteps.find(s => s.id === 'RAG') || workflowSteps.find(s => s.id === 'AGENT');
              const warStep = workflowSteps.find(s => s.id === 'WARROOM');
              const knwStep = workflowSteps.find(s => s.id === 'KNOWLEDGE');
              const now = new Date();
              const formatDHMS = (from, to) => {
                if (!from) return '-';
                const ms = (to ? new Date(to.timestamp) : now) - new Date(from.timestamp);
                if (ms < 0) return '-';
                const d = Math.floor(ms / 86400000);
                const h = Math.floor((ms % 86400000) / 3600000);
                const m = Math.floor((ms % 3600000) / 60000);
                const s = Math.floor((ms % 60000) / 1000);
                if (d > 0) return `${d}일 ${h}시간 ${m}분 ${s}초`;
                if (h > 0) return `${h}시간 ${m}분 ${s}초`;
                if (m > 0) return `${m}분 ${s}초`;
                return `${s}초`;
              };
              const phases = [
                { label: '인지', from: smsStep, to: ragStep },
                { label: '분석', from: ragStep, to: warStep },
                { label: '워룸진행', from: warStep, to: knwStep },
                { label: '처리완료', from: smsStep, to: knwStep },
              ];
              return (
                <div className="mb-4 p-3 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">장애처리현황 MTTR</div>
                  <div className="grid grid-cols-2 gap-2">
                    {phases.map(({ label, from, to }) => {
                      const isDone = !!to;
                      const isActive = !!from && !to;
                      return (
                        <div key={label} className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg border ${
                          isDone ? 'bg-emerald-500/5 border-emerald-500/20'
                          : isActive ? 'bg-blue-500/5 border-blue-500/20'
                          : 'bg-white/[0.01] border-white/5'
                        }`}>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-400' : isActive ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
                            <span className={`text-[9px] font-black ${isDone ? 'text-emerald-400' : isActive ? 'text-blue-400' : 'text-slate-600'}`}>{label}</span>
                          </div>
                          <span className={`text-[11px] font-black font-mono ${isDone ? 'text-emerald-300' : isActive ? 'text-blue-300' : 'text-slate-600'}`}>
                            {formatDHMS(from, to)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Content Area */}
            <div className="content-area min-h-[200px]">
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in zoom-in-95 duration-700">
                  <div className="relative">
                    <div className="w-20 h-20 border-[6px] border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-indigo-400 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-4">
                    <div className="px-4 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 inline-block mb-2">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">AI Agent Analysis in Progress</span>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                      분석 중입니다...
                    </h3>
                    <p className="text-sm text-slate-400 font-mono tracking-wide max-w-sm mx-auto leading-relaxed">
                      {loadingStatus || 'Dify AI 분석 엔진이 대응 내역을 정밀하게 분석하여 요약을 생성하고 있습니다.'}
                    </p>
                    <div className="flex items-center justify-center space-x-3 pt-4">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl flex items-center space-x-6 animate-in slide-in-from-top-4">
                  <div className="p-4 bg-red-500/20 rounded-2xl">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-red-400 text-lg font-black uppercase tracking-tight mb-1">오류 발생</h4>
                    <p className="text-sm text-red-300/70 leading-relaxed">{error}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/30 transition-all"
                    >
                      Retry Analysis
                    </button>
                  </div>
                </div>
              )}

              {!isLoading && !error && summary && (() => {
                  const sections = parseSections(summary);
                  let sectionNum = 0;
                  const sectionColorMap = [
                    { keys: ['타임라인'], style: null },
                    { keys: ['장애내용','장애 내용','장애 개요','개요'], style: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', num: 'bg-blue-500' } },
                    { keys: ['발생원인','발생 원인','핵심원인','핵심 원인','원인'], style: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', num: 'bg-amber-500' } },
                    { keys: ['진행결과','진행 결과','조치','처리'], style: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300', num: 'bg-indigo-500' } },
                    { keys: ['상황종료','상황 종료','종료','최종 결과','최종'], style: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', num: 'bg-emerald-500' } },
                    { keys: ['추가작업','추가 작업','향후','과제'], style: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', num: 'bg-purple-500' } },
                  ];
                  const getStyle = (title) => {
                    const entry = sectionColorMap.find(e => e.keys.some(k => title.includes(k)));
                    return entry ? entry.style : { bg: 'bg-white/[0.02]', border: 'border-white/5', text: 'text-slate-300', num: 'bg-slate-500' };
                  };
                  return (
                    <div id="report-content" className="animate-in fade-in duration-1000 relative space-y-4">
                      {sections.map((section, idx) => {
                        const isTimeline = section.title.includes('타임라인');
                        if (!isTimeline) sectionNum++;
                        const style = getStyle(section.title);
                        return (
                          <div
                            key={idx}
                            className={`group relative rounded-2xl p-4 border transition-all duration-300 ${
                              isTimeline
                                ? 'bg-white/[0.02] border-white/5'
                                : `${style?.bg} ${style?.border}`
                            }`}
                            style={{ animationDelay: `${idx * 100}ms` }}
                          >
                            {!isTimeline && style && (
                              <div className="mb-4">
                                <div className={`flex items-baseline gap-1.5 pb-2 border-b-2 ${style.border}`}>
                                  <span className={`text-base font-black tabular-nums ${style.text}`}>
                                    {sectionNum}.
                                  </span>
                                  <h3 className={`text-base font-black tracking-tight ${style.text}`}>
                                    {section.title}
                                  </h3>
                                </div>
                              </div>
                            )}
                            <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                              <MarkdownViewer text={section.content} />
                            </div>
                          </div>
                        );
                      })}
                      {isStreaming && (
                        <div className="flex items-center justify-center space-x-3 mt-8 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl animate-pulse">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                          </div>
                          <span className="text-sm font-bold text-indigo-300 tracking-wide">{loadingStatus || 'Dify AI가 실시간으로 분석 중입니다...'}</span>
                        </div>
                      )}
                    </div>
                  );
              })()}
            </div>

            {/* Additional Notes Section */}
            {!isLoading && summary && (
              <div className="mt-12 pt-8 border-t border-white/10 animate-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both print:border-slate-200">
                <div className="flex items-center space-x-2 mb-4 text-blue-400 print:text-blue-600">
                  <Zap className="w-4 h-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest">그외 처리 사항</h3>
                </div>
                <div className="relative group">
                  <textarea
                    className="w-full bg-black/20 border border-white/5 rounded-2xl p-6 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all min-h-[160px] resize-none placeholder:text-slate-600 print:bg-white print:border-slate-200 print:text-black print:placeholder:text-slate-300"
                    placeholder="여기에 추가적인 조치 사항이나 특이 사항을 입력하세요..."
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                  />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <BookMarked className="w-4 h-4 text-blue-500/50" />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 font-mono uppercase tracking-tight flex items-center print:hidden">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  이 영역의 내용은 보고서 전송 및 지식화에 함께 포함되어 적용됩니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-600 font-mono px-4 print:hidden">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Generated at {new Date().toLocaleTimeString()}
            </span>
            <span className="flex items-center uppercase tracking-widest">
              Security Tier 1
            </span>
          </div>
          <p>© 2026 S-GUARD AI. All Rights Reserved.</p>
        </div>
      </main>

      {/* Recipient Selection Modal */}
      {modalStep === 'selection' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#06080c]/95 backdrop-blur-md" onClick={() => setModalStep(null)} />
          
          <div className="bg-[#0f1219] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_-12px_rgba(37,99,235,0.3)] relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-600/10 to-transparent">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-600/20 p-2 rounded-xl border border-blue-500/30">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">보고 대상 선정</h3>
                  <p className="text-[10px] text-slate-500 font-mono">STEP 1: 수신자 확인</p>
                </div>
              </div>
              <button 
                onClick={() => setModalStep(null)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              <p className="text-sm text-slate-400 mb-4">분석 보고서를 전송할 상급자를 선택해주세요.</p>
              {reportingLines.map((line) => (
                <div 
                  key={line.id}
                  onClick={() => toggleLine(line.id)}
                  className={`flex items-center justify-between p-5 rounded-3xl border transition-all cursor-pointer ${
                    selectedLines.includes(line.id) 
                      ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-900/20' 
                      : 'bg-[#161b2a]/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                       selectedLines.includes(line.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-200 text-sm">{line.role} {line.name}</p>
                      <p className="text-[11px] text-slate-500 italic">{line.desc}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                    selectedLines.includes(line.id) ? 'bg-blue-600 border-blue-400 scale-110' : 'border-slate-700'
                  }`}>
                    {selectedLines.includes(line.id) && <Check className="w-4 h-4 text-white" />}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t border-white/5 bg-[#0a0d14] flex space-x-4">
              <button 
                onClick={() => setModalStep(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 h-16 rounded-[1.25rem] font-bold text-slate-300 transition-all border border-white/10 active:scale-95 text-sm"
              >
                닫기
              </button>
              <button 
                onClick={handleSendEmail}
                disabled={selectedLines.length === 0 || isSending}
                className={`flex-[1.8] h-16 rounded-[1.25rem] font-bold text-white transition-all flex items-center justify-center space-x-3 active:scale-95 text-sm shadow-lg ${
                  selectedLines.length === 0
                    ? 'bg-slate-800 opacity-50 cursor-not-allowed text-slate-500' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-600/20'
                }`}
              >
                <span>보고서 최종 전송</span>
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{ __html: `
        #report-content {
          /* Force standard color space for html2canvas compatibility */
          --tw-bg-opacity: 1 !important;
          color: #ffffff !important;
          
          /* Full Slate/Gray Palette Reset */
          --color-slate-50: #f8fafc !important; --color-slate-100: #f1f5f9 !important; --color-slate-200: #e2e8f0 !important;
          --color-slate-300: #cbd5e1 !important; --color-slate-400: #94a3b8 !important; --color-slate-500: #64748b !important;
          --color-slate-600: #475569 !important; --color-slate-700: #334155 !important; --color-slate-800: #1e293b !important;
          --color-slate-900: #0f172a !important; --color-slate-950: #020617 !important;
          
          /* Full Blue/Indigo Palette Reset */
          --color-blue-400: #60a5fa !important; --color-blue-500: #3b82f6 !important; --color-blue-600: #2563eb !important;
          --color-indigo-400: #818cf8 !important; --color-indigo-500: #6366f1 !important; --color-indigo-600: #4f46e5 !important;
          
          /* Semantic Colors */
          --color-emerald-400: #34d399 !important; --color-emerald-500: #10b981 !important;
          --color-amber-400: #fbbf24 !important; --color-amber-500: #f59e0b !important;
          --color-red-400: #f87171 !important; --color-red-500: #ef4444 !important;
          --color-purple-400: #c084fc !important; --color-purple-500: #a855f7 !important;

          /* Prose Variables (Critical for Markdown) */
          --tw-prose-body: #94a3b8 !important;
          --tw-prose-headings: #ffffff !important;
          --tw-prose-lead: #64748b !important;
          --tw-prose-links: #60a5fa !important;
          --tw-prose-bold: #ffffff !important;
          --tw-prose-counters: #64748b !important;
          --tw-prose-bullets: #475569 !important;
          --tw-prose-hr: #1e293b !important;
          --tw-prose-quotes: #f1f5f9 !important;
          --tw-prose-quote-borders: #2563eb !important;
          --tw-prose-captions: #64748b !important;
          --tw-prose-code: #ffffff !important;
          --tw-prose-pre-code: #e2e8f0 !important;
          --tw-prose-pre-bg: #0f172a !important;
          --tw-prose-th-borders: #334155 !important;
          --tw-prose-td-borders: #1e293b !important;
        }
        
        /* Utility Class Forced HEX Overrides */
        #report-content .text-slate-200 { color: #e2e8f0 !important; }
        #report-content .text-slate-300 { color: #cbd5e1 !important; }
        #report-content .text-slate-400 { color: #94a3b8 !important; }
        #report-content .text-slate-500 { color: #64748b !important; }
        #report-content .text-blue-300 { color: #93c5fd !important; }
        #report-content .text-blue-400 { color: #60a5fa !important; }
        #report-content .text-emerald-400 { color: #34d399 !important; }
        #report-content .text-amber-500 { color: #f59e0b !important; }
        #report-content .text-red-400 { color: #f87171 !important; }
        
        #report-content .bg-blue-500\\/10 { background-color: rgba(59, 130, 246, 0.1) !important; }
        #report-content .border-blue-500\\/20 { border-color: rgba(59, 130, 246, 0.2) !important; }
        #report-content .bg-black\\/20 { background-color: rgba(0, 0, 0, 0.2) !important; }
        #report-content .border-white\\/10 { border-color: rgba(255, 255, 255, 0.1) !important; }
        #report-content .border-white\\/5 { border-color: rgba(255, 255, 255, 0.05) !important; }

        @media print {
          body { background: #ffffff !important; color: #000000 !important; }
          #report-content { background: #ffffff !important; color: #000000 !important; border-color: #e2e8f0 !important; }
          .bg-slate-900, .bg-[#0f1421], .bg-[#1a1f2e], .bg-black\\/20 { background: #ffffff !important; }
          .text-white, .text-slate-200, .text-slate-300, .text-slate-400 { color: #000000 !important; }
          .border, .border-white\\/10, .border-white\\/5 { border-color: #e2e8f0 !important; }
          .text-blue-400, .text-blue-300, .text-emerald-400, .text-purple-400 { color: #2563eb !important; }
          .bg-gradient-to-r { background: #2563eb !important; }
          .prose { color: #000000 !important; max-width: 100% !important; }
        }
      ` }} />
      <BottomMenu currentPath="/chat" />
    </div>
  );
}
