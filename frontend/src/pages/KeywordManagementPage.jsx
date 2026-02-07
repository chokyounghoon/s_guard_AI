import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, X, Search, Hash, 
  AlertTriangle, CheckCircle, Shield, 
  Trash2, Save, Filter
} from 'lucide-react';

export default function KeywordManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('CRITICAL');
  const [keywords, setKeywords] = useState([
    { id: 1, word: 'Connection timeout', severity: 'CRITICAL', count: 124 },
    { id: 2, word: 'Memory leakage', severity: 'CRITICAL', count: 45 },
    { id: 3, word: 'Socket error', severity: 'MAJOR', count: 89 },
    { id: 4, word: 'CPU high usage', severity: 'MAJOR', count: 210 },
    { id: 5, word: 'Disk full', severity: 'CRITICAL', count: 32 },
    { id: 6, word: 'Auth failure', severity: 'NORMAL', count: 567 },
  ]);

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const newItem = {
      id: Date.now(),
      word: newKeyword.trim(),
      severity: selectedSeverity,
      count: 0
    };
    setKeywords([newItem, ...keywords]);
    setNewKeyword('');
  };

  const removeKeyword = (id) => {
    setKeywords(keywords.filter(k => k.id !== id));
  };

  const filteredKeywords = keywords.filter(k => 
    k.word.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white font-sans pb-24 relative">
      {/* Background Glow */}
      <div className="fixed top-0 left-0 w-full h-96 bg-blue-900/5 blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center p-5 sticky top-0 bg-[#0f111a]/90 backdrop-blur-md z-50 border-b border-white/5">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold">할당 키워드 관리</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Keyword Management System</p>
          </div>
        </div>
        <button className="bg-blue-600/20 text-blue-400 p-2 rounded-xl hover:bg-blue-600/30 transition-colors border border-blue-500/20">
          <Save className="w-5 h-5" />
        </button>
      </header>

      <main className="p-5 space-y-6">
        {/* Add Section */}
        <section className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 shadow-xl">
          <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            새 키워드 추가
          </h2>
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="감지할 키워드를 입력하세요..."
                className="w-full bg-[#11141d] border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex p-1 bg-[#11141d] rounded-xl border border-white/5">
                {['CRITICAL', 'MAJOR', 'NORMAL'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all ${
                      selectedSeverity === sev 
                        ? (sev === 'CRITICAL' ? 'bg-red-500 text-white shadow-lg shadow-red-900/40' : 
                           sev === 'MAJOR' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' : 
                           'bg-blue-500 text-white shadow-lg shadow-blue-900/40')
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
              <button 
                onClick={addKeyword}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-[0.98]"
              >
                추가하기
              </button>
            </div>
          </div>
        </section>

        {/* List Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-400" />
              키워드 리스트
            </h2>
            <div className="relative w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input 
                type="text"
                placeholder="검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#11141d] border border-white/5 rounded-full py-1.5 pl-9 pr-4 text-[11px] focus:outline-none focus:border-white/20"
              />
            </div>
          </div>

          <div className="grid gap-3">
            {filteredKeywords.map((k) => (
              <div 
                key={k.id}
                className="bg-[#11141d] p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-xl ${
                    k.severity === 'CRITICAL' ? 'bg-red-500/10' :
                    k.severity === 'MAJOR' ? 'bg-orange-500/10' : 'bg-blue-500/10'
                  }`}>
                    {k.severity === 'CRITICAL' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Shield className={`w-4 h-4 ${k.severity === 'MAJOR' ? 'text-orange-500' : 'text-blue-500'}`} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">{k.word}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[9px] font-bold ${
                        k.severity === 'CRITICAL' ? 'text-red-500' :
                        k.severity === 'MAJOR' ? 'text-orange-500' : 'text-blue-400'
                      }`}>
                        {k.severity}
                      </span>
                      <span className="text-[9px] text-slate-600 font-mono">Hits: {k.count}</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => removeKeyword(k.id)}
                  className="p-2 rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {filteredKeywords.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <Search className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
