import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Brain, RefreshCw } from 'lucide-react';
import AgentDiscussionPanel from '../../components/AgentDiscussionPanel';
import WarRoomChatPanel from '../../components/WarRoomChatPanel';
import AiInsightPanel from '../../components/AiInsightPanel';
import { getAuthHeaders } from '../../lib/authStore';
import { useBackNavigation } from '../../hooks/useBackNavigation';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileExpertAdvisor({ user }) {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const { incidentId } = useParams();

  const [smsData, setSmsData] = useState(null);
  const [agentMessages, setAgentMessages] = useState([]);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' | 'warroom' | 'insight'
  const [warRooms, setWarRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch incident data directly by ID
  const fetchIncident = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      // Use direct incident endpoint for better performance on mobile
      const cleanId = String(incidentId);
      const res = await fetch(`${API_BASE}/ai/incident/${cleanId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch incident');
      const data = await res.json();
      if (data.incident) {
        setSmsData(data.incident);
      }
    } catch (e) {
      console.error('[MobileExpertAdvisor] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  // Fetch war rooms
  const fetchWarRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/warroom/list`, { headers: getAuthHeaders() });
      if (res.ok) {
        const rooms = data.warRooms || data.rooms || [];
        const uniqueRooms = Array.from(new Map(rooms.map(r => [r.inc_id || r.id, r])).values());
        setWarRooms(uniqueRooms);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchIncident();
    fetchWarRooms();
  }, [fetchIncident, fetchWarRooms]);

  const deduplicateMessages = (msgs) => {
    const seen = new Set();
    return msgs.filter(m => {
      const key = `${m.role}:${(m.text || '').trim().substring(0, 30)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const parseTranscript = (text) => {
    if (!text) return [];
    const AGENT_ORDER = ['Security', 'DB', 'DevOps', 'Leader'];
    const detectAgentName = (str) => {
      const s = str.trim();
      if (/security/i.test(s))             return 'Security';
      if (/db|database/i.test(s))          return 'DB';
      if (/devops|infra|analyst/i.test(s)) return 'DevOps';
      if (/leader/i.test(s))              return 'Leader';
      return null;
    };
    const sectionMarkers = ['[전문가별 심층 진단]', '전문가별 심층 진단', '## 전문가', '### 전문가'];
    let startIndex = -1;
    for (const marker of sectionMarkers) {
      const idx = text.indexOf(marker);
      if (idx !== -1) { startIndex = idx; break; }
    }
    if (startIndex === -1) startIndex = 0;

    const lines = text.substring(startIndex).split('\n');
    const msgsMap = new Map();
    let currentAgent = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const bulletMatch = trimmed.match(/^[-•*·\d.]\s*\*{0,4}(Security|DB|DevOps|Leader)\s*Agent\*{0,4}\s*[:：]\s*(.+)/i);
      if (bulletMatch) {
        const agentName = detectAgentName(bulletMatch[1]);
        const content = bulletMatch[2].trim();
        if (agentName && content) {
          const prev = msgsMap.get(agentName) || '';
          msgsMap.set(agentName, prev + (prev ? '\n' : '') + content);
          currentAgent = agentName;
          continue;
        }
      }

      const isHeaderLike = (/^#{1,4}\s/.test(trimmed) || /^\*{1,2}[^*]/.test(trimmed) || /^\[.{2,40}\]/.test(trimmed) || /^\d+[\.]\s/.test(trimmed) || (/[：:]\s*$/.test(trimmed) && trimmed.length < 60));
      if (isHeaderLike && /security|db|database|devops|infra|leader/i.test(trimmed)) {
        const agentName = detectAgentName(trimmed);
        if (agentName) { currentAgent = agentName; continue; }
      }

      if (/\[?리더의 최종 조치 가이드\]?/.test(trimmed)) {
        currentAgent = 'Leader';
        const leaderPrev = msgsMap.get('Leader') || '';
        msgsMap.set('Leader', leaderPrev + (leaderPrev ? '\n' : '') + trimmed);
        continue;
      }

      if (currentAgent) {
        const prev = msgsMap.get(currentAgent) || '';
        msgsMap.set(currentAgent, prev + (prev ? '\n' : '') + trimmed);
      }
    }

    const result = [];
    for (const name of AGENT_ORDER) {
      const raw = msgsMap.get(name);
      if (!raw) continue;
      let processed = raw;
      const leadingPattern = new RegExp(`^[-•*·\\d.]\\s*\\*{0,4}${name}\\s*Agent\\*{0,4}\\s*[:：]\\s*`, 'i');
      processed = processed.replace(leadingPattern, '');
      const headerPattern = new RegExp(`^#{1,4}\\s+${name}\\s*Agent\\s*`, 'i');
      processed = processed.replace(headerPattern, '');
      processed = processed.replace(/^\[.*?\]\s*/, '');
      result.push({ role: name, text: processed.trim(), delay: 0 });
    }
    return result;
  };

  const handleAgentContent = useCallback((content, isDone) => {
    if (!content) return;
    const currentMsgs = parseTranscript(content);
    const filteredMsgs = currentMsgs.filter(m => {
      const isError = m.text && (
        m.text.includes('AI 엔진 서버 오류') || 
        m.text.includes('Dify 측 서버 상태가 불안정') ||
        m.text.includes('인증 오류') ||
        m.text.includes('엔드포인트 오류')
      );
      return m.role !== 'AI분석' && !isError;
    });

    if (isDone) {
      if (filteredMsgs.length > 0) {
        setShowAgentPanel(true);
        setAgentMessages(deduplicateMessages(filteredMsgs.map(m => ({ ...m, isCompleted: true }))));
      }
    } else {
      if (filteredMsgs.length >= 1) {
        setShowAgentPanel(true);
        setAgentMessages(deduplicateMessages(filteredMsgs.map(m => ({ ...m, isCompleted: false }))));
      }
    }
  }, []);

  const tabs = [
    { id: 'ai', label: 'AI 분석' },
    { id: 'warroom', label: 'War-Room' },
    { id: 'insight', label: 'S-Insight' },
  ];

  return (
    <div className="flex flex-col bg-[#060a12] min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#060a12]/90 backdrop-blur-xl border-b border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack()}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="bg-indigo-500/15 border border-indigo-500/25 p-2 rounded-xl shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-white text-base tracking-tight leading-none">S-Autopilot Expert Advisor</h1>
              {smsData && (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                  {String(smsData.inc_id)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { fetchIncident(); fetchWarRooms(); }}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-95 transition-transform"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-4 bg-white/[0.03] rounded-2xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-black tracking-tight transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Incident info bar */}
      {smsData && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Source SMS</p>
          <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">{smsData.message}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {smsData.service_name && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                {smsData.service_name}
              </span>
            )}
            {smsData.incident_status && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                {smsData.incident_status}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col px-4 mt-4 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center animate-pulse">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
        ) : !smsData ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <Brain className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest">인시던트를 찾을 수 없습니다</p>
          </div>
        ) : (
          <>
            <div className={`flex-1 bg-[#0a0c12] rounded-3xl border border-white/5 overflow-hidden ${activeTab === 'ai' ? 'flex flex-col' : 'hidden'}`} style={{ minHeight: 400 }}>
              <AgentDiscussionPanel
                messages={agentMessages}
                isVisible={true}
                embedded={true}
                incident={smsData}
                onClose={() => goBack()}
              />
            </div>

            <div className={`flex-1 bg-[#0a0c12] rounded-3xl border border-white/5 overflow-hidden ${activeTab === 'warroom' ? 'flex flex-col' : 'hidden'}`} style={{ minHeight: 400 }}>
              <WarRoomChatPanel
                incidentId={smsData.inc_id}
                currentUser={user || {}}
                isVisible={true}
              />
            </div>

            <div className={`pb-6 ${activeTab === 'insight' ? 'block' : 'hidden'}`}>
              <AiInsightPanel
                selectedSms={smsData}
                warRooms={warRooms}
                onLogReceived={() => {}}
                onShowDetail={() => {}}
                onOpenWarRoom={() => {}}
                onAgentContent={handleAgentContent}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
