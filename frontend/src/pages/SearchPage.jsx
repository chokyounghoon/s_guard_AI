import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, AlertCircle, Clock, 
  FileText, ChevronRight, X, TrendingUp, AlertTriangle, CheckCircle, Zap,
  Building2, User, MessageSquare, List
} from 'lucide-react';
import { SMS_WORKER_URL } from '../config/api';

const getDefaultConfig = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const tzOffset = end.getTimezoneOffset() * 60000; 
  
  const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
  
  return {
    startDate: new Date(start.getTime() - tzOffset).toISOString().split('T')[0],
    endDate: new Date(end.getTime() - tzOffset).toISOString().split('T')[0],
    assignee: ''
  };
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    incidentId: '',
    incidentName: '',
    startDate: getDefaultConfig().startDate,
    endDate: getDefaultConfig().endDate,
    org1: '신한DS', 
    org2: '',
    org3: '',
    org4: '',
    org5: '',
    assignee: getDefaultConfig().assignee
  });
  const [orgTree, setOrgTree] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [allIncidents, setAllIncidents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, unconfirmed: 0, processing: 0, resolved: 0 });
  const [activeCategory, setActiveCategory] = useState(null);

  // Helper to find a node in the organization tree
  const findNodeInTree = (nodes, target, depth = null) => {
    if (!nodes || !target) return null;
    const norm = String(target).trim().toLowerCase();
    for (const node of nodes) {
      const depthMatch = depth ? node.depth === depth : true;
      if (depthMatch) {
        if ((node.code && String(node.code).trim().toLowerCase() === norm) || 
            (String(node.name).trim().toLowerCase() === norm)) {
          return node;
        }
      }
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, target, depth);
        if (found) return found;
      }
    }
    return null;
  };

  useEffect(() => {
    Promise.all([
      fetch(`${SMS_WORKER_URL}/incidents`).then(r => r.json()),
      fetch(`${SMS_WORKER_URL}/users`).then(r => r.json()).catch(() => []),
      fetch(`${SMS_WORKER_URL}/org/tree`).then(r => r.json()).catch(() => [])
    ])
    .then(([incidentData, userData, treeData]) => {
         setOrgTree(treeData);
         const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
         const currentUser = userData.find(u => u.employee_id === savedUser.employee_id || u.name === savedUser.name) || savedUser;

         setSearchParams(prev => ({
           ...prev,
           org1: currentUser.company_code || currentUser.company || '신한DS',
           org2: currentUser.honbu_code || currentUser.honbu || '',
           org3: currentUser.team_code || currentUser.team || '',
           org4: currentUser.part_code || currentUser.part || '',
           org5: currentUser.subpart_code || currentUser.subpart || ''
         }));
         
         setAllUsers(userData);
         const processed = incidentData.map(inc => {
            const st = inc.status || '대기';
            let cat = '미확인';
            if (st.includes('미확인') || st === '대기' || st === '발생') cat = '미확인';
            else if (st.includes('처리') || st.includes('진행')) cat = '처리중';
            if (st.includes('완료') || st === '정상' || st === 'GOVERNED') cat = '조치완료';

            return {
              id: inc.inc_id,
              name: inc.title || 'Untitled',
              description: inc.description || '',
              severity: inc.severity || 'INFO',
              status: st,
              category: cat,
              date: inc.created_at ? inc.created_at.replace('T', ' ').substring(0, 16) : '',
              assignee: inc.assignee || '미지정',
              sender: inc.sender_phone || '알 수 없음',
              sender_id: inc.sender_employee_id || '',
              received_count: inc.received_count || 0,
              color: inc.severity === 'CRITICAL' ? 'red' : 
                     inc.severity === 'WARNING' ? 'orange' : 
                     inc.severity === 'MAJOR' ? 'orange' : 'blue'
            };
         });

         setAllIncidents(processed);
         setStats({
           total: processed.length,
           unconfirmed: processed.filter(i => i.category === '미확인').length,
           processing: processed.filter(i => i.category === '처리중').length,
           resolved: processed.filter(i => i.category === '조치완료').length
         });
      })
      .catch(console.error);
  }, []);

  const handleStatsClick = (catId) => {
    setActiveCategory(prev => prev === catId ? null : catId);
  };

  const collectSubtreeIds = (nodes, targetValue, targetDepth = null) => {
    let ids = [];
    const norm = String(targetValue).trim().toLowerCase();
    const traverse = (list, depth, collecting = false) => {
      for (const node of list) {
        const val = node.code || node.name;
        const match = (val && String(val).trim().toLowerCase() === norm) && (!targetDepth || depth === targetDepth);
        const shouldCollect = collecting || match;
        if (shouldCollect) {
          ids.push(node.code || node.name);
          if (node.name) ids.push(node.name); 
          if (node.code) ids.push(node.code);
        }
        if (node.children?.length) traverse(node.children, depth + 1, shouldCollect);
      }
    };
    traverse(nodes, 1);
    return [...new Set(ids)];
  };

  const handleAssigneeChange = (e) => {
    const newAssignee = e.target.value;
    let newParams = { ...searchParams, assignee: newAssignee };
    if (newAssignee) {
      const u = allUsers.find(user => user.name === newAssignee);
      if (u) {
        newParams.org1 = u.company_code || u.company || '신한DS';
        newParams.org2 = u.honbu_code || u.honbu || '';
        newParams.org3 = u.team_code || u.team || '';
        newParams.org4 = u.part_code || u.part || '';
        newParams.org5 = u.subpart_code || u.subpart || '';
      }
    }
    setSearchParams(newParams);
  };

  const handleSearch = async () => {
    setIsSearching(true);
    const params = new URLSearchParams();
    if (searchParams.incidentId) params.append('inc_id', searchParams.incidentId);
    if (searchParams.incidentName) params.append('keyword', searchParams.incidentName);
    if (searchParams.startDate) params.append('startDate', searchParams.startDate);
    if (searchParams.endDate) params.append('endDate', searchParams.endDate);
    
    const deepestVal = searchParams.org5 || searchParams.org4 || searchParams.org3 || searchParams.org2 || searchParams.org1;
    if (deepestVal && deepestVal !== '신한DS') params.append('orgCode', deepestVal);
    if (searchParams.assignee) params.append('assignee', searchParams.assignee);

    try {
      const response = await fetch(`${SMS_WORKER_URL}/incidents?${params.toString()}`);
      const incidentData = await response.json();
      const processed = incidentData.map(inc => {
         const st = inc.status || '대기';
         let cat = '미확인';
         if (st.includes('미확인') || st === '대기' || st === '발생') cat = '미확인';
         else if (st.includes('처리') || st.includes('진행')) cat = '처리중';
         if (st.includes('완료') || st === '정상' || st === 'GOVERNED') cat = '조치완료';

         const mainAssignee = inc.assignee_name || inc.assigned_to;
         const others = inc.assignment_list ? inc.assignment_list.split(',').filter(name => name !== mainAssignee) : [];
         const displayAssignee = others.length > 0 ? `${mainAssignee} 외 ${others.length}명` : (mainAssignee || '미지정');

         return {
           id: inc.inc_id,
           name: inc.title || 'Untitled',
           description: inc.raw_message || inc.description || '',
           raw_message: inc.raw_message || '',
           severity: inc.severity || 'INFO',
           status: st,
           category: cat,
           date: inc.created_at ? inc.created_at.replace('T', ' ').substring(0, 16) : '',
           assignee: displayAssignee,
           assignee_details: others.length > 0 ? [mainAssignee, ...others].join(', ') : mainAssignee,
           company: inc.company || '',
           honbu: inc.honbu || '',
           team: inc.team || '',
           part: inc.part || '',
           subpart: inc.subpart || '',
           sender: inc.sender_phone || '알 수 없음',
           sender_id: inc.sender_employee_id || '',
           received_count: inc.received_count || 0,
           color: inc.severity === 'CRITICAL' ? 'red' : inc.severity === 'WARNING' ? 'orange' : inc.severity === 'MAJOR' ? 'orange' : 'blue'
         };
      });

      setSearchResults(processed);
      setStats({
        total: processed.length,
        unconfirmed: processed.filter(i => i.category === '미확인').length,
        processing: processed.filter(i => i.category === '처리중').length,
        resolved: processed.filter(i => i.category === '조치완료').length
      });
      setActiveCategory(null);
    } catch (e) {
      console.error('Search error:', e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleQuickDate = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const tzOffset = end.getTimezoneOffset() * 60000; 
    const localStart = new Date(start.getTime() - tzOffset).toISOString().split('T')[0];
    const localEnd = new Date(end.getTime() - tzOffset).toISOString().split('T')[0];
    setSearchParams({ ...searchParams, startDate: localStart, endDate: localEnd });
  };

  const handleReset = () => {
    const defaultData = getDefaultConfig();
    setSearchParams({
      incidentId: '', incidentName: '', startDate: defaultData.startDate, endDate: defaultData.endDate,
      org1: '신한DS', org2: '', org3: '', org4: '', org5: '', assignee: ''
    });
    setSearchResults(null);
    setActiveCategory(null);
  };

  const getSubNodes = (parentCode) => {
    if (!parentCode) return orgTree;
    const parentNode = findNodeInTree(orgTree, parentCode);
    return parentNode ? (parentNode.children || []) : [];
  };

  const deepestOrgForUsers = searchParams.org5 || searchParams.org4 || searchParams.org3 || searchParams.org2 || searchParams.org1;
  const filteredUsers = React.useMemo(() => {
    if (!deepestOrgForUsers || deepestOrgForUsers === '신한DS') return allUsers;
    const validIds = collectSubtreeIds(orgTree, deepestOrgForUsers);
    return allUsers.filter(u => 
      validIds.includes(u.company_code) || validIds.includes(u.honbu_code) ||
      validIds.includes(u.team_code) || validIds.includes(u.part_code) || validIds.includes(u.subpart_code)
    ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allUsers, deepestOrgForUsers, orgTree]);

  const l1Nodes = getSubNodes(null);
  const l2Nodes = getSubNodes(searchParams.org1);
  const l3Nodes = getSubNodes(searchParams.org2);
  const l4Nodes = getSubNodes(searchParams.org3);
  const l5Nodes = getSubNodes(searchParams.org4);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans flex flex-col pb-24">
      <header className="flex items-center justify-between p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2"><Search className="w-5 h-5 text-blue-400" />장애 검색</h1>
            <p className="text-[10px] text-slate-500 font-mono italic">INCIDENT SEARCH CENTER</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-6">
        <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2"><Filter className="w-5 h-5 text-blue-400" />검색 조건</h2>
            <button onClick={handleReset} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-all">
              <X className="w-3.5 h-3.5" />초기화
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold ml-1">장애 ID</label>
              <input type="text" value={searchParams.incidentId} onChange={(e) => setSearchParams({...searchParams, incidentId: e.target.value})} placeholder="ID 입력" className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-bold ml-1">장애명 / 키워드</label>
              <input type="text" value={searchParams.incidentName} onChange={(e) => setSearchParams({...searchParams, incidentName: e.target.value})} placeholder="키워드 입력" className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50" />
            </div>

            <div className="sm:col-span-2 space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between mb-2">
                 <label className="text-xs text-slate-300 font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" />조회 기준일</label>
                 <div className="flex gap-1.5 bg-[#0a0e17] p-1 rounded-xl">
                    {[0, 7, 30].map(d => (
                      <button key={d} type="button" onClick={() => handleQuickDate(d)} className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-colors">{d === 0 ? '오늘' : `${d}일`}</button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={searchParams.startDate} onChange={(e) => setSearchParams({...searchParams, startDate: e.target.value})} className="bg-[#0a0e17] border border-white/10 rounded-xl px-4 py-3 text-sm" style={{ colorScheme: 'dark' }} />
                <input type="date" value={searchParams.endDate} onChange={(e) => setSearchParams({...searchParams, endDate: e.target.value})} className="bg-[#0a0e17] border border-white/10 rounded-xl px-4 py-3 text-sm" style={{ colorScheme: 'dark' }} />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
               <label className="text-xs text-slate-300 font-bold flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-blue-400" />조직 및 담당자</label>
               <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                  <select value={searchParams.org1} onChange={(e) => setSearchParams({...searchParams, org1: e.target.value, org2: '', org3: '', org4: '', org5: ''})} className="bg-[#11141d] border border-white/10 rounded-xl px-3 py-2 text-[11px]"><option value="">전체</option>{l1Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org2} onChange={(e) => setSearchParams({...searchParams, org2: e.target.value, org3: '', org4: '', org5: ''})} disabled={!searchParams.org1} className="bg-[#11141d] border border-white/10 rounded-xl px-3 py-2 text-[11px] disabled:opacity-30"><option value="">부문</option>{l2Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org3} onChange={(e) => setSearchParams({...searchParams, org3: e.target.value, org4: '', org5: ''})} disabled={!searchParams.org2} className="bg-[#11141d] border border-white/10 rounded-xl px-3 py-2 text-[11px] disabled:opacity-30"><option value="">본부</option>{l3Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org4} onChange={(e) => setSearchParams({...searchParams, org4: e.target.value, org5: ''})} disabled={!searchParams.org3} className="bg-[#11141d] border border-white/10 rounded-xl px-3 py-2 text-[11px] disabled:opacity-30"><option value="">팀</option>{l4Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org5} onChange={(e) => setSearchParams({...searchParams, org5: e.target.value})} disabled={!searchParams.org4} className="bg-[#11141d] border border-white/10 rounded-xl px-3 py-2 text-[11px] disabled:opacity-30"><option value="">파트</option>{l5Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.assignee} onChange={handleAssigneeChange} className="bg-[#11141d] border border-blue-500/30 rounded-xl px-3 py-2 text-[11px] text-blue-300"><option value="">담당자</option>{filteredUsers.map(u => <option key={u.employee_id} value={u.name}>{u.name}</option>)}</select>
               </div>
            </div>

            <button type="submit" disabled={isSearching} className="sm:col-span-2 bg-gradient-to-r from-blue-600 to-blue-500 py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-blue-900/40 transition-all active:scale-[0.98] disabled:opacity-50">
              {isSearching ? '조회 중...' : '검색 찾기'}
            </button>
          </form>
        </div>

        {searchResults !== null && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
              {[
                { id: 'all', label: '전체 건수', count: stats.total, icon: AlertTriangle, color: 'blue' },
                { id: '미확인', label: '미확인', count: stats.unconfirmed, icon: AlertCircle, color: 'red' },
                { id: '처리중', label: '처리중', count: stats.processing, icon: Clock, color: 'orange' },
                { id: '조치완료', label: '처리완료', count: stats.resolved, icon: CheckCircle, color: 'emerald' },
              ].map((stat) => (
                <div key={stat.id} onClick={() => handleStatsClick(stat.id)} 
                     className={`cursor-pointer group relative overflow-hidden transition-all duration-300 rounded-3xl p-5 border shadow-lg 
                       ${activeCategory === stat.id 
                         ? `bg-${stat.color}-500/20 border-${stat.color}-500/50 shadow-${stat.color}-500/20 scale-[1.03]` 
                         : 'bg-[#1a1f2e] border-white/5 hover:border-white/10 hover:bg-[#1f2536]'}`}>
                  <div className="flex items-center justify-between relative z-10">
                    <stat.icon className={`w-5 h-5 ${activeCategory === stat.id ? `text-${stat.color}-400` : 'text-slate-500'}`} />
                    <span className={`text-3xl font-black text-${stat.color}-400 font-mono drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]`}>{stat.count}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2.5 font-bold tracking-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            {activeCategory && (
              <div className="bg-[#1a1f2e] rounded-3xl p-5 border border-white/5 shadow-2xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between px-1 mb-1">
                  <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-blue-400" />{activeCategory === 'all' ? '전체 내역' : `${activeCategory} 내역`}</h3>
                </div>
                <div className="space-y-3">
                  {searchResults.filter(i => activeCategory === 'all' || i.category === activeCategory).map((incident, i) => (
                    <div 
                      key={i} 
                      onClick={() => navigate('/chat/' + incident.id)} 
                      className="bg-[#1a1f2e] p-6 rounded-3xl border border-white/5 hover:border-blue-500/40 transition-all cursor-pointer group relative overflow-hidden shadow-2xl"
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full bg-${incident.color}-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]`} />
                      
                      <div className="flex items-start gap-4 mb-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-${incident.color}-500/10 border border-${incident.color}-500/20`}>
                          <MessageSquare className={`w-6 h-6 text-${incident.color}-400`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                               <h4 className="font-black text-slate-100 text-base tracking-tight">SMS 수신</h4>
                               <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border tracking-widest uppercase
                                 ${incident.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border-red-500/30' : 
                                   incident.severity === 'WARNING' ? 'bg-orange-500/20 text-orange-500 border-orange-500/30' : 
                                   'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                               >
                                 {incident.severity}
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                 {incident.date}
                               </span>
                               <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-all" />
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-bold">발신:</span>
                              <span className="text-xs text-slate-300 font-bold">{incident.sender}</span>
                            </div>
                            {incident.sender_id && (
                              <span className="text-[10px] text-blue-400 font-black bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                사번: {incident.sender_id}
                              </span>
                            )}
                            {incident.received_count > 1 && (
                              <span className="text-[10px] text-emerald-400 font-black bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                {incident.received_count}건 중복수신
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#11141d] p-5 rounded-2xl border border-white/5 group-hover:bg-[#141824] transition-all mb-5 relative">
                        <div className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                          <p className="text-sm leading-relaxed text-slate-200 font-medium">
                            {incident.raw_message || incident.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs font-black text-blue-300">담당: {incident.assignee}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-60">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px] font-bold text-slate-400">
                              {[incident.honbu, incident.team, incident.part]
                                .map(code => findNodeInTree(orgTree, code)?.name)
                                .filter(Boolean)
                                .join(' > ') || '미지정'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="px-2 py-1 rounded-lg text-[10px] font-black border bg-slate-800 text-slate-300 border-slate-700 tracking-tight">
                             {incident.status}
                           </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {searchResults.filter(i => activeCategory === 'all' || i.category === activeCategory).length === 0 && <div className="text-center py-10 text-slate-600 text-[11px]">데이터가 없습니다.</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
