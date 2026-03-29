import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Clock, 
  AlertCircle,
  Shield,
  Printer,
  History
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';

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
              if (!line.startsWith('data:')) continue;
              const dataStr = line.slice(5).trim();
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
                console.error('Error parsing SSE data', e);
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
            <h1 className="text-sm font-black tracking-widest uppercase text-blue-400">AI Chat Briefing</h1>
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
        <div className="bg-[#1a1f2e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-8 print:shadow-none print:border-slate-200">
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
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">최종 요약 리포트</span>
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
            <div className="prose prose-invert prose-blue max-w-none">
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
                <div className="animate-in fade-in duration-1000">
                  <MarkdownViewer text={summary} />
                  {isLoading && (
                    <div className="flex items-center space-x-2 mt-4 text-xs text-blue-400 animate-pulse">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                      <span>작성 중...</span>
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
        @media print {
          body { background: white !important; color: black !important; }
          .bg-slate-900, .bg-[#0f1421], .bg-[#1a1f2e], .bg-black\\/20 { background: white !important; }
          .text-white, .text-slate-200, .text-slate-300 { color: black !important; }
          .border, .border-white\\/10, .border-white\\/5 { border-color: #e2e8f0 !important; }
          .text-blue-400, .text-blue-300, .text-emerald-400, .text-purple-400 { color: #2563eb !important; }
          .bg-gradient-to-r { background: #2563eb !important; }
          .prose { color: black !important; max-width: 100% !important; }
          main { padding-top: 0 !important; }
        }
      ` }} />
    </div>
  );
}
