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
  Database
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
  
  const abortControllerRef = useRef(null);

  const getApiUrl = (endpoint) => {
    const apiBase = window.location.hostname === 'localhost' 
      ? 'https://sguardai.khcho0421.workers.dev' 
      : 'https://sguardai.khcho0421.workers.dev';
    return `${apiBase}${endpoint}`;
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
                  setSummary(prev => prev + data.answer);
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
          setError('요크 생성 중 오류가 발생했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();

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

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const handleRegisterKnowledge = async () => {
    if (!summary || isRegistering) return;
    setIsRegistering(true);
    
    try {
      const res = await fetch(getApiUrl('/ai/register-knowledge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incidentId,
          title: `[WAR-ROOM REPORT] ${incidentId}`,
          content: summary,
          category: '인시던트 요약',
          tags: 'WarRoom,Summary,AI'
        })
      });
      
      if (res.ok) {
        setRegisterSuccess(true);
        alert('S-Guard 지식 베이스에 성공적으로 등록되었습니다.');
        setTimeout(() => setRegisterSuccess(false), 3000);
      } else {
        const err = await res.json();
        alert(`등록 실패: ${err.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error('Knowledge register error:', err);
      alert('지식 등록 중 오류가 발생했습니다.');
    } finally {
      setIsRegistering(false);
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
            <h1 className="text-sm font-black tracking-widest uppercase text-blue-400">WAR-ROOM SUMMARY</h1>
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
            onClick={handleRegisterKnowledge}
            disabled={isRegistering || isLoading || !summary}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-black transition-all border active:scale-95 shadow-xl ${
              registerSuccess 
                ? 'bg-emerald-600 border-emerald-500/50 text-white shadow-emerald-500/20' 
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 border-indigo-400/30 text-white shadow-indigo-500/20 hover:scale-105 active:scale-95'
            } disabled:opacity-50 group origin-right`}
          >
            {isRegistering ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : registerSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
            )}
            <div className="flex flex-col items-start leading-none space-y-0.5">
              <span className="text-[10px] opacity-70 font-mono tracking-widest uppercase">Governance</span>
              <span>{isRegistering ? 'Approving Knowledge...' : registerSuccess ? 'RAG Updated' : '최종 승인 및 RAG 업데이트'}</span>
            </div>
          </button>

          <button 
            onClick={handleSendEmail}
            disabled={isSending || isLoading || !summary}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-95 ${
              sendSuccess 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20' 
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSending ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : sendSuccess ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Database className="w-3.5 h-3.5 font-bold" />
            )}
            <span>{isSending ? 'Sending PDF...' : sendSuccess ? 'Sent to Leader ✓' : '팀장님 전송'}</span>
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
        <div id="report-content" className="bg-[#1a1f2e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-8 print:shadow-none print:border-slate-200">
          {/* Top accent bar */}
          <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />
          
          <div className="p-8 md:p-12">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full inline-flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">AI-Generated Summary</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black leading-tight">
                  장애 대응 협업 <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">WAR-ROOM 요약 레포트</span>
                </h2>
              </div>
              <div className="text-right hidden sm:block">
                <FileText className="w-12 h-12 text-slate-700 ml-auto mb-2" />
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Formal Document</div>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">S-Guard AI Engine v2.0</div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 p-6 bg-black/20 rounded-2xl border border-white/5">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 font-bold uppercase">Incident ID</div>
                <div className="text-sm font-mono text-blue-300">{incidentId}</div>
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
                  <span className="text-sm text-amber-500/70 font-bold">Restricted</span>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="content-area min-h-[400px]">
              {isLoading && !summary ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 animate-pulse font-mono tracking-wide">
                    AI가 채팅 내역을 분석하여 요약 리포트를 생성하고 있습니다...
                  </p>
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
                    <div className="flex items-center space-x-2 mt-4 text-xs text-blue-400 animate-pulse bg-blue-500/5 p-2 rounded-lg border border-blue-500/10 inline-flex">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <span className="font-bold uppercase tracking-widest text-[9px]">S-Guard AI 분석 진행 중...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
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
