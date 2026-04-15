import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, Download, Search, RefreshCw, User, Globe, Monitor, Clock, FileText } from 'lucide-react';

const SecurityLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const apiBase = 'https://sguardai.khcho0421.workers.dev';

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/security/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error('Failed to fetch security logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDownloadCSV = () => {
    if (logs.length === 0) return;

    const headers = ["접속시간", "사번", "이름", "이메일", "IP 주소", "상태", "접속 환경"];
    const rows = logs.map(log => [
      new Date(log.login_time).toLocaleString('ko-KR'),
      log.user_id,
      log.user_name || 'N/A',
      log.email,
      log.ip_address,
      log.status,
      log.user_agent.replace(/,/g, ' ') // CSV 쉼표 오류 방지
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SGUARD_Security_Access_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = logs.filter(log => 
    (log.user_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.ip_address || '').includes(searchTerm) ||
    (log.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-600/20 rounded-xl">
              <Shield className="w-8 h-8 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Access Control & Security Audit</h1>
          </div>
          <p className="text-slate-400">시스템 접속 이력 및 Zero Trust 보안 감사 로그</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-xs text-slate-500 font-medium tracking-wider">TOTAL LOGS</span>
          </div>
          <div className="text-2xl font-bold">{logs.length}건</div>
          <div className="text-sm text-slate-500 mt-1">최근 100건의 접속 시도</div>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-xs text-slate-500 font-medium tracking-wider">UNIQUE IPs</span>
          </div>
          <div className="text-2xl font-bold">{new Set(logs.map(l => l.ip_address)).size}개</div>
          <div className="text-sm text-slate-500 mt-1">현재 활성 접속 소스</div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-xs text-slate-500 font-medium tracking-wider">FAILURES</span>
          </div>
          <div className="text-2xl font-bold">{logs.filter(l => l.status === 'FAILURE').length}건</div>
          <div className="text-sm text-slate-500 mt-1">차단된 비정상 접근 시도</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="사번, 이름, 이메일 또는 IP 주소로 검색..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0f172a] border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">접속 시간</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">사용자 정보</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP 주소</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">상태</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">디바이스 / 브라우저</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium">
                        {new Date(log.login_time).toLocaleString('ko-KR', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-100">{log.user_name || '로그인 시도 중'}</span>
                      <span className="text-xs text-slate-500">{log.user_id || log.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500/70" />
                      <code className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">
                        {log.ip_address}
                      </code>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'SUCCESS' 
                        ? 'bg-green-500/10 text-green-400' 
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {log.status === 'SUCCESS' ? '정상 승인' : '차단됨'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400 max-w-xs truncate">
                      <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
                      {log.user_agent}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    {loading ? '로그를 불러오는 중...' : '검색 결과와 일치하는 로그가 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
        <Shield className="w-3 h-3" />
        모든 접속 로그는 신한금융그룹의 보안 정책에 따라 5년간 보관되며, 무단 유출 시 법적 책임을 질 수 있습니다.
      </div>
    </div>
  );
};

export default SecurityLogPage;
