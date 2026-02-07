import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, AlertCircle, Clock, 
  FileText, ChevronRight, X, TrendingUp, AlertTriangle, CheckCircle, Zap
} from 'lucide-react';

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    incidentId: '',
    incidentName: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Mock search data
  const mockIncidents = [
    { 
      id: 'INC-8823', 
      name: 'Server-02 타임아웃 오류', 
      description: 'DB Connection Pool 고갈로 인한 연결 거부 현상',
      severity: 'CRITICAL',
      status: '조치 완료',
      date: '2023-10-25 13:42',
      duration: '24분',
      assignee: '김철수',
      color: 'red'
    },
    { 
      id: 'INC-8821', 
      name: '카드 결제 시스템 지연', 
      description: '외부 PG사 연동 API 응답 지연 발생',
      severity: 'MAJOR',
      status: '처리 중',
      date: '2023-10-25 11:15',
      duration: '2시간 18분',
      assignee: '이영희',
      color: 'orange'
    },
    { 
      id: 'INC-8818', 
      name: 'WAS 메모리 급증', 
      description: '애플리케이션 메모리 누수 의심',
      severity: 'MAJOR',
      status: '조치 완료',
      date: '2023-10-24 16:30',
      duration: '1시간 45분',
      assignee: '박지성',
      color: 'orange'
    },
    { 
      id: 'INC-8815', 
      name: '로그인 실패 증가', 
      description: '세션 타임아웃 설정 오류로 인한 재로그인 필요',
      severity: 'MEDIUM',
      status: '조치 완료',
      date: '2023-10-24 09:20',
      duration: '35분',
      assignee: '최민수',
      color: 'yellow'
    },
    { 
      id: 'INC-8810', 
      name: 'API 게이트웨이 오류', 
      description: '라우팅 테이블 설정 오류',
      severity: 'MEDIUM',
      status: '조치 완료',
      date: '2023-10-23 14:05',
      duration: '1시간 12분',
      assignee: '정수진',
      color: 'blue'
    },
  ];

  const handleSearch = () => {
    setIsSearching(true);
    
    // Simulate API call
    setTimeout(() => {
      // Filter mock data based on search params
      let filtered = mockIncidents.filter(incident => {
        const matchId = !searchParams.incidentId || incident.id.toLowerCase().includes(searchParams.incidentId.toLowerCase());
        const matchName = !searchParams.incidentName || incident.name.toLowerCase().includes(searchParams.incidentName.toLowerCase());
        const matchDesc = !searchParams.description || incident.description.toLowerCase().includes(searchParams.description.toLowerCase());
        return matchId && matchName && matchDesc;
      });
      
      setSearchResults(filtered);
      setIsSearching(false);
    }, 800);
  };

  const handleReset = () => {
    setSearchParams({
      incidentId: '',
      incidentName: '',
      description: '',
      startDate: '',
      endDate: '',
    });
    setSearchResults(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans flex flex-col pb-24">
      {/* Background Effects */}
      <div className="fixed top-0 left-0 w-full h-96 bg-blue-900/5 blur-[100px] -z-10 pointer-events-none" />
      
      {/* Header */}
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              장애 검색
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">INCIDENT SEARCH & FILTER</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-6">
        
        {/* Search Form */}
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-400" />
              검색 조건
            </h2>
            <button 
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all"
            >
              <X className="w-3.5 h-3.5" />
              초기화
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Incident ID */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                장애 ID
              </label>
              <input
                type="text"
                value={searchParams.incidentId}
                onChange={(e) => setSearchParams({...searchParams, incidentId: e.target.value})}
                placeholder="예: INC-8823"
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Incident Name */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                장애명
              </label>
              <input
                type="text"
                value={searchParams.incidentName}
                onChange={(e) => setSearchParams({...searchParams, incidentName: e.target.value})}
                placeholder="예: 서버 타임아웃"
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Description */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                장애 내용
              </label>
              <input
                type="text"
                value={searchParams.description}
                onChange={(e) => setSearchParams({...searchParams, description: e.target.value})}
                placeholder="예: DB Connection Pool"
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                시작일
              </label>
              <input
                type="date"
                value={searchParams.startDate}
                onChange={(e) => setSearchParams({...searchParams, startDate: e.target.value})}
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                종료일
              </label>
              <input
                type="date"
                value={searchParams.endDate}
                onChange={(e) => setSearchParams({...searchParams, endDate: e.target.value})}
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-900/30"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>검색 중...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>검색</span>
              </>
            )}
          </button>
        </div>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                검색 결과
                <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/30">
                  {searchResults.length}건
                </span>
              </h2>
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((incident, i) => (
                  <div 
                    key={i}
                    onClick={() => navigate('/assignment-detail')}
                    className={`bg-[#11141d] p-5 rounded-2xl border border-white/5 hover:border-${incident.color}-500/30 transition-all cursor-pointer group relative overflow-hidden`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full bg-${incident.color}-500`} />
                    
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                          incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' :
                          incident.severity === 'MAJOR' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' :
                          'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">{incident.id}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                    </div>

                    <h3 className="font-bold text-slate-200 mb-2 group-hover:text-blue-400 transition-colors">
                      {incident.name}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      {incident.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {incident.date}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          소요: {incident.duration}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg border ${
                          incident.status === '조치 완료' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {incident.status}
                        </span>
                        <span className="text-slate-600">담당: {incident.assignee}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-400 font-medium">검색 조건에 맞는 장애 내역이 없습니다</p>
                <p className="text-xs text-slate-600 mt-2">다른 검색 조건으로 다시 시도해보세요</p>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        {!searchResults && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: '전체 장애', count: '156', icon: AlertTriangle, color: 'blue' },
              { label: '진행 중', count: '8', icon: Clock, color: 'orange' },
              { label: '조치 완료', count: '142', icon: CheckCircle, color: 'emerald' },
              { label: '이번 주', count: '23', icon: TrendingUp, color: 'purple' },
            ].map((stat, i) => (
              <div key={i} className={`bg-gradient-to-br from-${stat.color}-500/10 to-${stat.color}-600/5 border border-${stat.color}-500/20 rounded-2xl p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
                  <span className={`text-2xl font-black text-${stat.color}-400 font-mono`}>{stat.count}</span>
                </div>
                <p className="text-xs text-slate-400 font-bold">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
