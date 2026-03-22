import React, { useState, useEffect } from 'react';
import { Database, AlertCircle, Clock, ChevronRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Layer1LogPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const API_BASE = 'https://sguardai.khcho0421.workers.dev';

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      // We'll use the existing /incidents endpoint but filter for type=LOG
      const res = await fetch(`${API_BASE}/incidents?incident_type=LOG&limit=5`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.incidents || []);
      }
    } catch (err) {
      console.error("Failed to fetch LOG incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && logs.length === 0) {
    return <div className="h-48 bg-[#1a1f2e] rounded-3xl animate-pulse border border-white/5"></div>;
  }

  return (
    <div className="bg-[#1a1f2e] rounded-3xl border border-white/5 shadow-xl overflow-hidden transition-all duration-300 mb-6">
      <div className="p-6 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600/20 p-2 rounded-xl">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Layer 1: 시스템 로그 수집 (HDFS)</h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase">Loghub Dataset Ingestion · Anomaly Detection</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/incident-list?type=LOG')}
          className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
        >
          전체보기 <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {logs.length > 0 ? (
          logs.map((log) => (
            <div 
              key={log.id}
              className="bg-[#11141d] border border-white/5 rounded-2xl p-4 hover:border-emerald-500/30 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                   <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                     log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 
                     'bg-orange-500/20 text-orange-400 border border-orange-500/20'
                   }`}>
                     {log.severity}
                   </span>
                   <span className="text-[10px] text-slate-500 font-mono italic">{log.code}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors mb-1">
                {log.title}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-1 italic font-mono">
                {log.description}
              </p>
            </div>
          ))
        ) : (
          <div className="py-10 text-center opacity-50">
            <p className="text-sm text-slate-500 italic">감지된 로그 이상 징후가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
