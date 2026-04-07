import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  CheckCircle2,
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
  CheckCircle
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import html2pdf from 'html2pdf.js';

export default function ChatSummaryPage() {
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState(null);
  const [modalStep, setModalStep] = useState(null); // 'selection' or null
  const [selectedLines, setSelectedLines] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('');
  
  const abortControllerRef = useRef(null);

  const [reportingLines, setReportingLines] = useState([]);

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
      setError(null);
      
      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch(getApiUrl('/ai/summarize-chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id: incidentId }),
          signal: controller.signal
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
                if (data.answer) {
                  setSummary(prev => {
                    const newText = prev + data.answer;
                    // Clean up the specific Dify optimization message if it appears
                    return newText.replace(/🚀 고속 분석 엔진\(Dify\) 최적화 통신을 시작합니다\.\.\.\s*/g, "");
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
        setIsLoading(false);
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

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [incidentId]);

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

    setIsGoverning(true);
    
    const fullContent = `${summary}\n\n### [그외 처리 사항]\n${additionalNotes || '없음'}`;

    try {
      // Step 1: Knowledge Base Registration (RAG Update)
      const resGov = await fetch(getApiUrl('/ai/governance/approve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId,
          title: `[KNOWLEDGE REG] ${incidentId}`,
          content: fullContent
        })
      });
      
      if (!resGov.ok) {
        const err = await resGov.json();
        throw new Error(err.error || '거버넌스 승인 실패');
      }

      // Step 2: War-Room Status Resolution
      const resRes = await fetch(getApiUrl('/warroom/resolve'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId })
      });

      if (resRes.ok) {
        setGovSuccess(true);
        setIncidentStatus('처리완료');
        alert("지식화 및 장애/보고 처리가 성공적으로 완료되었습니다.\n인시던트 상태가 '처리완료'로 업데이트되었습니다.");
        // Final Step: Redirect to Dashboard
        navigate('/dashboard');
      } else {
        throw new Error('장애 처리 상태 업데이트 실패');
      }
    } catch (err) {
      console.error('Resolution error:', err);
      alert(`처리 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsGoverning(false);
    }
  };

  const toggleLine = (id) => {
    setSelectedLines(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0f1421] text-white font-sans pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#0f1421]/80 backdrop-blur-md border-b border-white/5 z-50 px-6 flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-95"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase text-blue-400">WAR-ROOM TIMELINE REPORT</h1>
            <p className="text-[10px] text-slate-500 font-mono">{incidentId}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={handleCopy}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold transition-all active:scale-95"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
          
          <button 
            onClick={handleGovernance}
            disabled={isGoverning || isLoading || !summary || govSuccess || incidentStatus === '처리완료'}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all border active:scale-95 shadow-xl ${
              (govSuccess || incidentStatus === '처리완료')
                ? 'bg-emerald-600 border-emerald-500/50 text-white shadow-emerald-500/20 opacity-80 cursor-default' 
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 border-indigo-400/30 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95'
            } disabled:opacity-50 group origin-right`}
          >
            {isGoverning ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : govSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
            )}
            <div className="flex flex-col items-start leading-none space-y-0.5">
              <span className="text-[10px] opacity-70 font-mono tracking-widest uppercase">Closure</span>
              <span>{isGoverning ? 'Processing Closure...' : (govSuccess || incidentStatus === '처리완료') ? '처리 완료됨' : '지식화/장애/보고/완료 처리'}</span>
            </div>
          </button>

          <button 
            onClick={handlePrint}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-6 max-w-4xl mx-auto">
        {/* Report Cover Style Component */}
        <div id="report-content" className="bg-[#1a1f2e] border border-white/10 rounded-3xl overflow-visible shadow-2xl mb-8 print:shadow-none print:border-slate-200">
          {/* Top accent bar */}
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="p-8 md:p-12">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full inline-flex items-center space-x-2 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-tighter">AI-Generated Timeline</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black leading-tight uppercase tracking-tight">
                  장애 대응 <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Collaborative Timeline</span>
                </h2>
              </div>
              <div className="text-right hidden sm:block">
                <FileText className="w-12 h-12 text-slate-700 ml-auto mb-2" />
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Formal Document</div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">S-Guard AI Engine v2.0</div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 p-6 bg-black/20 rounded-2xl border border-white/5 font-mono">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Incident ID</div>
                <div className="text-sm font-bold text-blue-300">{incidentId}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Summary Date</div>
                <div className="text-sm">{new Date().toLocaleDateString('ko-KR')}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Report Status</div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-sm text-emerald-400 font-bold">Verified</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Confidentiality</div>
                <div className="flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-500/70" />
                  <span className="text-sm text-amber-500/70 font-bold uppercase">Restricted</span>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="content-area min-h-[400px]">
              {isLoading && !summary ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 animate-pulse font-mono tracking-wide">
                    Dify AI 엔진을 통해 채팅 내역을 분석하여 리포트를 생성하고 있습니다. 잠시만 기다려 주세요...
                  </p>
                  <p className="text-xs text-blue-500 font-black animate-bounce tracking-widest uppercase">처리중입니다..</p>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl flex items-center space-x-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <h4 className="text-red-400 font-bold">오류 발생</h4>
                    <p className="text-sm text-red-300/70">{error}</p>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-1000 relative">
                  <MarkdownViewer text={summary} />
                  {isLoading && (
                    <div className="flex items-center space-x-2 mt-6 text-xs text-blue-400 animate-pulse bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 inline-flex shadow-lg shadow-blue-500/10">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </div>
                      <span className="font-black uppercase tracking-widest text-[10px]">Dify AI Hyper-Processing: 처리중입니다..</span>
                    </div>
                  )}
                </div>
              )}
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
                  이 영역의 내용은 PDF 리포트와 메일 전송 시 함께 포함됩니다.
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

      {/* Floating Action Button for returning */}
      <button 
        onClick={() => navigate(-1)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800/80 hover:bg-slate-700 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full flex items-center space-x-3 transition-all hover:scale-105 active:scale-95 shadow-2xl print:hidden"
      >
        <History className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold uppercase tracking-wider">Back to War-Room</span>
      </button>

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
    </div>
  );
}
