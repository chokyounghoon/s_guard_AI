import React from 'react';
import { Copy, Share2, Sparkles, CheckCircle } from 'lucide-react';

export default function AIChatBubble({ message, onCopy, onShare }) {
  const formatTimestamp = () => {
    const date = new Date();
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const parseMarkdown = (text) => {
    // Simple markdown parser for bold, code blocks, and lists
    const lines = text.split('\n');
    const elements = [];
    let codeBlock = null;
    let codeLines = [];

    lines.forEach((line, idx) => {
      // Code block detection
      if (line.trim().startsWith('```')) {
        if (codeBlock === null) {
          codeBlock = line.replace('```', '').trim();
        } else {
          // End code block
          elements.push(
            <div key={`code-${idx}`} className="bg-[#0d0f14] border border-blue-500/20 rounded-xl p-4 my-3 font-mono text-xs overflow-x-auto">
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

      // Bold text **text**
      let processedLine = line;
      processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
      
      // List items
      if (line.trim().startsWith('-')) {
        elements.push(
          <div key={idx} className="flex items-start space-x-2 my-1">
            <span className="text-blue-400 mt-1">•</span>
            <span dangerouslySetInnerHTML={{ __html: processedLine.replace(/^-\s*/, '') }} />
          </div>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={idx} className="my-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: processedLine }} />
        );
      }
    });

    return elements;
  };

  return (
    <div className="flex items-start space-x-3 animate-in fade-in slide-in-from-left-4 duration-300">
      {/* AI Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-purple-900/40">
        <Sparkles className="w-5 h-5 text-white" />
      </div>

      <div className="flex flex-col space-y-2 max-w-[85%]">
        {/* AI Name Tag */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-purple-400 font-bold">S-Autopilot AI</span>
          <span className="text-[9px] text-slate-500 font-mono">{formatTimestamp()}</span>
        </div>

        {/* Message Bubble */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-purple-500/20 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur-sm">
          {parseMarkdown(message.text)}

          {/* Metrics Display (if present) */}
          {message.metrics && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10">
              <MetricCard label="CPU" value={message.metrics.cpu} unit="%" color="blue" />
              <MetricCard label="Memory" value={message.metrics.memory} unit="%" color="purple" />
              <MetricCard label="Response" value={message.metrics.responseTime} unit="ms" color="cyan" />
            </div>
          )}

          {/* Confidence Badge (if present) */}
          {message.confidence && (
            <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/10">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">
                신뢰도 {message.confidence}%
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onCopy && onCopy(message.text)}
            className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-white/5 hover:border-blue-500/30 rounded-lg text-[10px] text-slate-400 hover:text-blue-400 transition-all flex items-center space-x-1"
          >
            <Copy className="w-3 h-3" />
            <span>복사</span>
          </button>
          <button
            onClick={() => onShare && onShare(message.text)}
            className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-700 border border-white/5 hover:border-purple-500/30 rounded-lg text-[10px] text-slate-400 hover:text-purple-400 transition-all flex items-center space-x-1"
          >
            <Share2 className="w-3 h-3" />
            <span>팀에 공유</span>
          </button>
        </div>
      </div>
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
