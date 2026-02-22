import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Activity, Filter, Clock, ChevronRight, 
  AlertCircle, MessageSquare, Brain, CheckCircle, Search
} from 'lucide-react';

export default function IncidentListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get('type') || 'AI';
  const category = queryParams.get('category') || 'All';

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // Mock data for the detailed list
  const incidents = [
    { 
      id: 'INC-8823', 
      title: 'Server-02 Timeout Error', 
      desc: 'Significant latency detected in transaction processing.',
      time: '18:45',
      date: '2023-10-25',
      status: 'In Progress',
      severity: 'Major'
    },
    { 
      id: 'INC-8821', 
      title: 'Database Connection Pool Exhaustion', 
      desc: 'Connection pool reaching 95% threshold on node prkjap01.',
      time: '14:30',
      date: '2023-10-25',
      status: 'Unconfirmed',
      severity: 'Major'
    },
    { 
      id: 'INC-8818', 
      title: 'EAI Resource Conflict', 
      desc: 'Intermittent failed transactions on interface IF-990.',
      time: '11:15',
      date: '2023-10-25',
      status: 'Completed',
      severity: 'Normal'
    },
    { 
      id: 'INC-8815', 
      title: 'MCI Response Time Spike', 
      desc: 'Response time exceeded 500ms for mobile clients in area SL.',
      time: '09:20',
      date: '2023-10-25',
      status: 'Completed',
      severity: 'Normal'
    }
  ].filter(item => {
    if (category === 'All') return true;
    if (category === 'Critical' && item.severity === 'Critical') return true;
    if (category === 'Major' && item.severity === 'Major') return true;
    if (category === 'Normal' && item.severity === 'Normal') return true;
    if (category === 'Processing' && item.status === 'In Progress') return true;
    if (category === 'Unconfirmed' && item.status === 'Unconfirmed') return true;
    if (category === 'Completed' && item.status === 'Completed') return true;
    return false;
  });

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
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
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
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                    incident.severity === 'Major' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 'bg-blue-500/20 text-blue-500 border-blue-500/30'
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
                   <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                     incident.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                     incident.status === 'Unconfirmed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                     'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                   }`}>
                     {incident.status}
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
