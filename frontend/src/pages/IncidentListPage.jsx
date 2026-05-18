import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Activity, Filter, Clock, ChevronRight,
  AlertCircle, MessageSquare, Brain, CheckCircle, Search
} from 'lucide-react';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useCodebook } from '../context/CodebookContext';

export default function IncidentListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useBackNavigation('/dashboard');
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get('type') || 'AI';
  const category = queryParams.get('category') || 'All';
  const { allCodes } = useCodebook();

  const getStatusName = (code) => {
    if (!code) return '미처리';
    const norm = String(code).toUpperCase().trim();
    const found = allCodes.find(c => c.category === 'INCIDENT_STATUS' && (c.code.toUpperCase() === norm || c.name.toUpperCase() === norm));
    if (found) return found.name;
    if (norm === 'INC_001' || norm === 'OPEN' || norm === '미확인' || norm === '대기') return '미처리';
    if (norm === 'INC_002' || norm === 'PROGRESS' || norm === '분석중' || norm === '처리중' || norm === '진행중') return '진행중';
    if (norm === 'INC_003' || norm === 'CLOSED' || norm === '처리완료' || norm === '조치완료') return '처리완료';
    return code;
  };

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const [incidents, setIncidents] = useState([]);

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'All') {
      if (['Critical', 'Major', 'Normal'].includes(category)) params.set('severity', category.toUpperCase());
      if (category === 'Processing') params.set('status', 'INC_002');
      if (category === 'Unconfirmed') params.set('status', 'INC_001');
      if (category === 'Completed') params.set('status', 'INC_003');
    }
    if (type) params.set('incident_type', type);

    fetch(`${API_BASE}/incidents?${params}&limit=50`)
      .then(r => r.json())
      .then(data => {
        setIncidents((data.incidents || data || []).map(inc => ({
          id: inc.inc_id || inc.code || inc.id,
          title: inc.title,
          desc: inc.description || '',
          time: inc.created_at ? new Date(inc.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '',
          date: inc.created_at ? inc.created_at.split('T')[0] : '',
          status: inc.status,
          severity: inc.severity === 'CRITICAL' ? 'Critical' : inc.severity === 'MAJOR' ? 'Major' : 'Normal',
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [type, category]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06080c] text-white flex flex-col p-4 space-y-4">
      {/* Header */}
      <header className="flex items-center space-x-4 bg-[#11141d] p-4 rounded-3xl border border-white/5 sticky top-0 z-50">
        <button onClick={() => goBack()} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            {type === 'AI' ? <Brain className="w-5 h-5 text-blue-400" /> : <MessageSquare className="w-5 h-5 text-purple-400" />}
            {type} {category} 리스트
          </h1>
          <p className="text-[10px] text-slate-500 font-mono">SELECTED CATEGORY DETAIL ({incidents.length})</p>
        </div>
      </header>

      {/* List */}
      <main className="flex-1 space-y-3">
        {incidents.length > 0 ? (
          incidents.map((incident) => (
            <div
              key={incident.id}
              onClick={() => navigate(`/assignment-detail?status=${incident.status}`)}
              className="bg-[#11141d] p-5 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${incident.severity === 'Major' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                    }`}>
                    {incident.severity.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{incident.id}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  {incident.time}
                </div>
              </div>

              <h3 className="font-bold text-slate-200 mb-1 group-hover:text-blue-400 transition-colors truncate">
                {incident.title}
              </h3>
              <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                {incident.desc}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Activity className="w-3.5 h-3.5" />
                  <span>{incident.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${incident.status === 'INC_003' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      incident.status === 'INC_001' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                    {getStatusName(incident.status)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-50">
            <Search className="w-12 h-12 text-slate-600" />
            <p className="text-sm font-bold text-slate-500">데이터가 없습니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
