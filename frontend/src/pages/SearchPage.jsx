import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, AlertCircle, Clock, 
  FileText, ChevronRight, X, TrendingUp, AlertTriangle, CheckCircle, Zap,
  Building2, User, MessageSquare, List
} from 'lucide-react';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { SMS_WORKER_URL } from '../config/api';
import { useTheme } from '../context/ThemeContext';

const getDefaultConfig = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  const tzOffset = end.getTimezoneOffset() * 60000; 
  
  const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
  
  return {
    startDate: new Date(start.getTime() - tzOffset).toISOString().split('T')[0],
    endDate: new Date(end.getTime() - tzOffset).toISOString().split('T')[0],
    assignee: savedUser.name || ''
  };
};

export default function SearchPage() {
  const { isLight } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useBackNavigation('/dashboard');

  const cleanText = (txt) => {
    if (!txt) return '';
    return String(txt).replace(/\*\*/g, '').trim();
  };

  const [searchParams, setSearchParams] = useState({
    incidentId: '',
    incidentName: location.state?.keyword || '',
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
    const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
    const deepestVal = savedUser.subpart_code || savedUser.subpart || savedUser.part_code || savedUser.part || savedUser.team_code || savedUser.team || savedUser.honbu_code || savedUser.honbu || savedUser.company_code || savedUser.company || '신한DS';
    const defaultData = getDefaultConfig();
    const params = new URLSearchParams();
    if (location.state?.keyword) params.append('keyword', location.state.keyword);
    if (defaultData.startDate) params.append('startDate', defaultData.startDate);
    if (defaultData.endDate) params.append('endDate', defaultData.endDate);
    if (deepestVal && deepestVal !== '신한DS') params.append('orgCode', deepestVal);
    if (savedUser.name) params.append('assignee', savedUser.name);

    Promise.all([
      fetch(`${SMS_WORKER_URL}/incidents?${params.toString()}`).then(r => r.json()),
      fetch(`${SMS_WORKER_URL}/users`).then(r => r.json()).catch(() => []),
      fetch(`${SMS_WORKER_URL}/org/tree`).then(r => r.json()).catch(() => [])
    ])
    .then(([incidentData, userData, treeData]) => {
         setOrgTree(treeData);
         const savedUser = JSON.parse(localStorage.getItem('sguard_user') || '{}');
         const currentUser = userData.find(u => u.employee_id === savedUser.employee_id || u.name === savedUser.name) || savedUser;

         const getOrgCode = (val) => {
           if (!val) return '';
           const node = findNodeInTree(treeData, val);
           return node ? (node.code || node.name) : val;
         };

         setSearchParams(prev => ({
           ...prev,
           org1: getOrgCode(currentUser.company_code || currentUser.company || '신한DS'),
           org2: getOrgCode(currentUser.honbu_code || currentUser.honbu),
           org3: getOrgCode(currentUser.team_code || currentUser.team),
           org4: getOrgCode(currentUser.part_code || currentUser.part),
           org5: getOrgCode(currentUser.subpart_code || currentUser.subpart),
           assignee: currentUser.name || ''
         }));
         
         setAllUsers(userData);
         const processed = incidentData.map(inc => {
            const st = inc.status || '대기';
            let cat = '미확인';
            if (st.includes('미확인') || st === '대기' || st === '발생' || st === 'INC_001' || st === 'OPEN') cat = '미확인';
            else if (st.includes('처리') || st.includes('진행') || st === 'INC_002') cat = '분석중입니다';
            if (st.includes('완료') || st === '정상' || st === 'GOVERNED' || st === 'INC_003' || st === 'CLOSED') cat = '조치완료';

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
              color: inc.severity === 'CRITICAL' ? 'red' : 
                     inc.severity === 'WARNING' ? 'orange' : 
                     inc.severity === 'MAJOR' ? 'orange' : 'blue'
            };
         });

         setAllIncidents(processed);
         setSearchResults(processed);
         setStats({
           total: processed.length,
           unconfirmed: processed.filter(i => i.category === '미확인').length,
           processing: processed.filter(i => i.category === '분석중입니다').length,
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
         if (st.includes('미확인') || st === '대기' || st === '발생' || st === 'INC_001' || st === 'OPEN') cat = '미확인';
         else if (st.includes('처리') || st.includes('진행') || st === 'INC_002') cat = '분석중입니다';
         if (st.includes('완료') || st === '정상' || st === 'GOVERNED' || st === 'INC_003' || st === 'CLOSED') cat = '조치완료';

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
        processing: processed.filter(i => i.category === '분석중입니다').length,
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
    <div className={`min-h-screen font-sans flex flex-col pb-24 transition-colors ${
      isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0e17] text-white'
    }`}>
      <header className={`flex items-center justify-between p-5 sticky top-0 backdrop-blur-md z-50 border-b transition-colors ${
        isLight ? 'bg-white/95 border-slate-200 shadow-sm text-slate-900' : 'bg-[#0f111a]/90 border-white/5 text-white'
      }`}>
        <div className="flex items-center space-x-3">
          <button onClick={() => goBack()} className={`p-2 rounded-full transition-colors ${
            isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-white'
          }`}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className={`text-lg font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Search className="w-5 h-5 text-blue-500" />장애 검색
            </h1>
            <p className={`text-[10px] font-mono italic ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>INCIDENT SEARCH CENTER</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-6">
        <div className={`rounded-3xl p-6 border shadow-xl space-y-6 transition-colors ${
          isLight ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50' : 'bg-[#1a1f2e] border-white/5 text-white shadow-xl'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Filter className="w-5 h-5 text-blue-500" />검색 조건
            </h2>
            <button 
              onClick={handleReset} 
              className={`text-xs flex items-center gap-1 px-3 py-2 rounded-xl transition-all border ${
                isLight 
                  ? 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border-slate-300' 
                  : 'text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
              }`}
            >
              <X className="w-3.5 h-3.5" />초기화
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>장애 ID</label>
              <input 
                type="text" 
                value={searchParams.incidentId} 
                onChange={(e) => setSearchParams({...searchParams, incidentId: e.target.value})} 
                placeholder="ID 입력" 
                className={`w-full rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors border ${
                  isLight 
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500' 
                    : 'bg-[#11141d] border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50'
                }`} 
              />
            </div>
            <div className="space-y-2">
              <label className={`text-xs font-bold ml-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>장애명 / 키워드</label>
              <input 
                type="text" 
                value={searchParams.incidentName} 
                onChange={(e) => setSearchParams({...searchParams, incidentName: e.target.value})} 
                placeholder="키워드 입력" 
                className={`w-full rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors border ${
                  isLight 
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500' 
                    : 'bg-[#11141d] border-white/10 text-white placeholder-slate-500 focus:border-blue-500/50'
                }`} 
              />
            </div>

            <div className={`sm:col-span-2 space-y-3 p-4 rounded-2xl border transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                 <label className={`text-xs font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                   <Calendar className="w-4 h-4 text-blue-500" />조회 기준일
                 </label>
                 <div className={`flex gap-1.5 p-1 rounded-xl border ${
                   isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-[#0a0e17] border-white/5'
                 }`}>
                    {[0, 7, 30].map(d => (
                      <button 
                        key={d} 
                        type="button" 
                        onClick={() => handleQuickDate(d)} 
                        className={`px-3 py-1 text-[10px] font-bold transition-colors rounded-lg ${
                          isLight ? 'text-slate-700 hover:text-blue-600 hover:bg-white/80' : 'text-slate-400 hover:text-blue-400'
                        }`}
                      >
                        {d === 0 ? '오늘' : `${d}일`}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="date" 
                  value={searchParams.startDate} 
                  onChange={(e) => setSearchParams({...searchParams, startDate: e.target.value})} 
                  className={`border rounded-xl px-4 py-3 text-sm transition-colors ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#0a0e17] border-white/10 text-white focus:border-blue-500/50'
                  }`} 
                  style={{ colorScheme: isLight ? 'light' : 'dark' }} 
                />
                <input 
                  type="date" 
                  value={searchParams.endDate} 
                  onChange={(e) => setSearchParams({...searchParams, endDate: e.target.value})} 
                  className={`border rounded-xl px-4 py-3 text-sm transition-colors ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-[#0a0e17] border-white/10 text-white focus:border-blue-500/50'
                  }`} 
                  style={{ colorScheme: isLight ? 'light' : 'dark' }} 
                />
              </div>
            </div>

            <div className={`sm:col-span-2 space-y-2 p-4 rounded-2xl border transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
            }`}>
               <label className={`text-xs font-bold flex items-center gap-2 mb-2 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                 <Building2 className="w-4 h-4 text-blue-500" />조직 및 담당자
               </label>
               <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                  <select value={searchParams.org1} onChange={(e) => setSearchParams({...searchParams, org1: e.target.value, org2: '', org3: '', org4: '', org5: ''})} className={`border rounded-xl px-3 py-2 text-[11px] transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#11141d] border-white/10 text-white'}`}><option value="">전체</option>{l1Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org2} onChange={(e) => setSearchParams({...searchParams, org2: e.target.value, org3: '', org4: '', org5: ''})} disabled={!searchParams.org1} className={`border rounded-xl px-3 py-2 text-[11px] transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#11141d] border-white/10 text-white'} disabled:opacity-40`}><option value="">부문</option>{l2Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org3} onChange={(e) => setSearchParams({...searchParams, org3: e.target.value, org4: '', org5: ''})} disabled={!searchParams.org2} className={`border rounded-xl px-3 py-2 text-[11px] transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#11141d] border-white/10 text-white'} disabled:opacity-40`}><option value="">본부</option>{l3Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org4} onChange={(e) => setSearchParams({...searchParams, org4: e.target.value, org5: ''})} disabled={!searchParams.org3} className={`border rounded-xl px-3 py-2 text-[11px] transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#11141d] border-white/10 text-white'} disabled:opacity-40`}><option value="">팀</option>{l4Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.org5} onChange={(e) => setSearchParams({...searchParams, org5: e.target.value})} disabled={!searchParams.org4} className={`border rounded-xl px-3 py-2 text-[11px] transition-colors ${isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#11141d] border-white/10 text-white'} disabled:opacity-40`}><option value="">파트</option>{l5Nodes.map(n => <option key={n.id} value={n.code || n.name}>{n.name}</option>)}</select>
                  <select value={searchParams.assignee} onChange={handleAssigneeChange} className={`border rounded-xl px-3 py-2 text-[11px] font-bold transition-colors ${isLight ? 'bg-white border-blue-400 text-blue-700' : 'bg-[#11141d] border-blue-500/30 text-blue-300'}`}><option value="">담당자</option>{filteredUsers.map(u => <option key={u.employee_id} value={u.name}>{u.name}</option>)}</select>
               </div>
            </div>

            <button 
              type="submit" 
              disabled={isSearching} 
              className="sm:col-span-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 rounded-2xl hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? '조회 중...' : '검색 찾기'}
            </button>
          </form>
        </div>

        {searchResults !== null && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-1">
              {[
                { id: 'all', label: '전체 건수', count: stats.total, icon: AlertTriangle, color: 'blue', lightText: 'text-blue-600' },
                { id: '미확인', label: '미확인', count: stats.unconfirmed, icon: AlertCircle, color: 'red', lightText: 'text-red-600' },
                { id: '분석중입니다', label: '분석중입니다', count: stats.processing, icon: Clock, color: 'orange', lightText: 'text-amber-600' },
                { id: '조치완료', label: '처리완료', count: stats.resolved, icon: CheckCircle, color: 'emerald', lightText: 'text-emerald-600' },
              ].map((stat) => (
                <div 
                  key={stat.id} 
                  onClick={() => handleStatsClick(stat.id)} 
                  className={`cursor-pointer group relative overflow-hidden transition-all duration-300 rounded-3xl p-5 border shadow-md ${
                    activeCategory === stat.id 
                      ? (isLight 
                          ? `bg-white border-2 border-blue-500 shadow-lg ring-2 ring-blue-400/30 scale-[1.02]` 
                          : `bg-${stat.color}-500/20 border-${stat.color}-500/50 shadow-${stat.color}-500/20 scale-[1.03]`) 
                      : (isLight 
                          ? 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900 shadow-sm' 
                          : 'bg-[#1a1f2e] border-white/5 hover:border-white/10 hover:bg-[#1f2536]')
                  }`}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <stat.icon className={`w-5 h-5 ${activeCategory === stat.id ? (isLight ? stat.lightText : `text-${stat.color}-400`) : 'text-slate-400'}`} />
                    <span className={`text-3xl font-black font-mono drop-shadow-sm ${isLight ? stat.lightText : `text-${stat.color}-400`}`}>
                      {stat.count}
                    </span>
                  </div>
                  <p className={`text-xs mt-2.5 font-bold tracking-tight ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {activeCategory && (
              <div className={`rounded-3xl p-5 border shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-300 transition-colors ${
                isLight ? 'bg-slate-100/90 border-slate-300 text-slate-900' : 'bg-[#1a1f2e] border-white/5 text-white'
              }`}>
                <div className="flex items-center justify-between px-1 mb-1">
                  <h3 className={`text-xs font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
                    <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                    {activeCategory === 'all' ? '전체 내역' : `${activeCategory} 내역`}
                  </h3>
                </div>
                <div className="space-y-3">
                  {searchResults.filter(i => activeCategory === 'all' || i.category === activeCategory).map((incident, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        const cleanId = String(incident.id);
                        if (incident.category === '조치완료' || incident.status === '처리완료' || incident.status === 'INC_003') {
                          navigate(`/report/${cleanId}`);
                        } else {
                          navigate('/chat/' + cleanId);
                        }
                      }}
                      className={`p-6 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden shadow-md hover:shadow-xl ${
                        isLight 
                          ? 'bg-white border-slate-200 hover:border-blue-400 text-slate-900' 
                          : 'bg-[#1a1f2e] border-white/5 hover:border-blue-500/40 shadow-2xl text-white'
                      }`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full bg-${incident.color}-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]`} />
                      
                      <div className="flex items-start gap-4 mb-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          isLight 
                            ? 'bg-blue-50 border border-blue-200 text-blue-600' 
                            : `bg-${incident.color}-500/10 border border-${incident.color}-500/20 text-${incident.color}-400`
                        }`}>
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2">
                               <h4 className={`font-black text-base tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                 SMS 수신
                               </h4>
                               <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border tracking-widest uppercase ${
                                 incident.severity === 'CRITICAL' 
                                   ? (isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/20 text-red-500 border-red-500/30') 
                                   : incident.severity === 'WARNING' 
                                     ? (isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-orange-500/20 text-orange-500 border-orange-500/30') 
                                     : (isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/20 text-blue-400 border-blue-500/30')
                               }`}>
                                 {incident.severity}
                               </span>
                             </div>
                             <div className="flex items-center gap-2">
                               <span className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border ${
                                 isLight ? 'text-slate-600 bg-slate-100 border-slate-200' : 'text-slate-400 bg-white/5 border-white/5'
                               }`}>
                                 {incident.date}
                               </span>
                               <ChevronRight className={`w-5 h-5 transition-all ${isLight ? 'text-slate-400 group-hover:text-blue-600' : 'text-slate-600 group-hover:text-blue-400'}`} />
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>발신:</span>
                              <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>{incident.sender}</span>
                            </div>
                            {incident.sender_id && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                isLight ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                              }`}>
                                사번: {incident.sender_id}
                              </span>
                            )}
                            {incident.received_count > 1 && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                                isLight ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              }`}>
                                {incident.received_count}건 중복수신
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`p-5 rounded-2xl border transition-all mb-5 relative ${
                        isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 text-slate-900 shadow-inner' : 'bg-[#11141d] border-white/5 hover:bg-[#141824] text-slate-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className={`text-sm leading-relaxed font-medium ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                            {cleanText(incident.raw_message || incident.description)}
                          </p>
                        </div>
                      </div>
                      
                      <div className={`flex items-center justify-between pt-4 border-t ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                            isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                          }`}>
                            <User className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-black">담당: {incident.assignee}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-80">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {[incident.honbu, incident.team, incident.part]
                                .map(code => findNodeInTree(orgTree, code)?.name)
                                .filter(Boolean)
                                .join(' > ') || '미지정'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border tracking-tight ${
                             isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                           }`}>
                             <span>{incident.category === '분석중입니다' ? '분석중입니다...' : (incident.category === '조치완료') ? '처리 완료됨' : '지식화/장애/보고/완료 처리'}</span>
                           </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {searchResults.filter(i => activeCategory === 'all' || i.category === activeCategory).length === 0 && (
                    <div className={`text-center py-10 text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                      데이터가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
