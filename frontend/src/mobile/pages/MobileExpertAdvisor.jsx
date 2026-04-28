import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Brain, RefreshCw } from 'lucide-react';
import AgentDiscussionPanel from '../../components/AgentDiscussionPanel';
import WarRoomChatPanel from '../../components/WarRoomChatPanel';
import AiInsightPanel from '../../components/AiInsightPanel';
import { getAuthHeaders } from '../../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

export default function MobileExpertAdvisor({ user }) {
  const navigate = useNavigate();
  const { incidentId } = useParams();

  const [smsData, setSmsData] = useState(null);
  const [agentMessages, setAgentMessages] = useState([]);
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' | 'warroom' | 'insight'
  const [warRooms, setWarRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch incident SMS data
  const fetchIncident = useCallback(async () => {
    if (!incidentId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/sms/recent?limit=50`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const found = (data.messages || []).find(m =>
        String(m.inc_id).replace('INC-', '') === String(incidentId).replace('INC-', '')
      );
      if (found) setSmsData(found);
    } catch (e) {
      console.error('[MobileExpertAdvisor]', e);
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  // Fetch war rooms
  const fetchWarRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/warroom/list`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setWarRooms(data.warRooms || data.rooms || []);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchIncident();
    fetchWarRooms();
  }, [fetchIncident, fetchWarRooms]);

  const handleAgentContent = useCallback((content, isDone) => {
    if (!content) return;
    setAgentMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'AI Expert') {
        return [...prev.slice(0, -1), { ...last, text: content }];
      }
      return [...prev, { role: 'AI Expert', text: content }];
    });
    if (isDone) setShowAgentPanel(true);
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
            onClick={() => navigate(-1)}
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
            {activeTab === 'ai' && (
              <div className="flex-1 bg-[#0a0c12] rounded-3xl border border-white/5 overflow-hidden" style={{ minHeight: 400 }}>
                <AgentDiscussionPanel
                  messages={agentMessages}
                  isVisible={true}
                  embedded={true}
                  incident={smsData}
                  onClose={() => navigate(-1)}
                />
              </div>
            )}

            {activeTab === 'warroom' && (
              <div className="flex-1 bg-[#0a0c12] rounded-3xl border border-white/5 overflow-hidden" style={{ minHeight: 400 }}>
                <WarRoomChatPanel
                  incidentId={smsData.inc_id}
                  currentUser={user || {}}
                  isVisible={true}
                />
              </div>
            )}

            {activeTab === 'insight' && (
              <div className="pb-6">
                <AiInsightPanel
                  selectedSms={smsData}
                  warRooms={warRooms}
                  onLogReceived={() => {}}
                  onShowDetail={() => {}}
                  onOpenWarRoom={() => {}}
                  onAgentContent={handleAgentContent}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
