import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Activity, Search, MoreHorizontal, Users, User, Network, Shield, FileText, Bot, BookOpen, Inbox, Cpu, Layers } from 'lucide-react';

export default function BottomMenu({ currentPath, onWarRoomClick, onReportClick, onAiClick, showAiPulse = true, user }) {
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      {/* Flat Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f1219]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center px-2 pt-3 pb-[env(safe-area-inset-bottom,12px)] print:hidden">
        {[
          { id: 'home', label: '홈', icon: Home, path: '/dashboard' },
          { id: 'chat', label: 'War-Room', icon: MessageSquare, path: '/chat', action: onWarRoomClick },
          { id: 'report', label: 'Report', icon: FileText, path: '/ai-report', action: onReportClick },
          { id: 'inbox', label: 'Inbox', icon: Inbox, path: '/inbox' },
          { id: 'ai', label: 'AI', icon: Bot, action: onAiClick, isAi: true },
          { id: 'more', label: '더보기', icon: MoreHorizontal, action: () => setShowMoreMenu(true) },
        ].map((item) => {
          const isActive = currentPath === item.path || (item.path && currentPath?.startsWith(item.path));
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => item.action ? item.action() : navigate(item.path)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-all duration-200 relative min-w-[48px] ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              {isActive && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
              <div className="relative">
                <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]' : ''}`} />
                {item.isAi && showAiPulse && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border border-[#0f111a] animate-pulse" />
                )}
              </div>
              <span className={`text-[9px] font-bold tracking-tight leading-none ${isActive ? 'text-blue-400' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* More Menu Popup */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowMoreMenu(false)} />
          <div className="w-full max-w-xl bg-premium-dark rounded-t-[3rem] border-t border-white/10 shadow-2xl relative z-10 animate-in slide-in-from-bottom duration-500 overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="pt-4 pb-2 px-8 flex flex-col items-center">
              <div className="w-12 h-1.5 bg-white/10 rounded-full mb-6" />
              <h3 className="text-2xl font-black text-white tracking-tighter">System Console</h3>
              <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em] mt-1">Management & Intelligence</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
              {[
                { label: 'Orbital Command', sub: 'Zero-G RAG Control', icon: Cpu, path: '/orbital-command', color: 'cyan' },
                { label: 'Report Line', sub: 'Approval Hierarchy', icon: Users, path: '/report-line-management', color: 'purple' },
                { label: 'Manual Entry', sub: 'Incident Injection', icon: MessageSquare, path: '/incident-push', color: 'green' },
                { label: 'Accounts', sub: 'Security Admin', icon: User, path: '/user-management', color: 'blue' },
                { label: 'Security Logs', sub: 'Access Audit Trails', icon: Shield, path: '/security-logs', color: 'indigo', adminOnly: true },
                { label: 'Organization', sub: 'Org Hierarchy', icon: Network, path: '/organization-management', color: 'emerald' },
                { label: 'Knowledge Base', sub: 'RAG Knowledge', icon: FileText, path: '/knowledge-base', color: 'sky' },
                { label: 'Global Stats', sub: 'System Metrics', icon: Activity, path: '/overall-status', color: 'orange' },
                { label: 'War-Room Hub', sub: 'Active Channels', icon: Shield, path: '/warroom-management', color: 'red' },
                { label: 'Activity Logs', sub: 'User Footprints', icon: Activity, path: '/activity', color: 'cyan' },
                { label: 'Codebook', sub: 'Common Metadata', icon: BookOpen, path: '/codebook-management', color: 'yellow' },
                { label: 'Data Flow', sub: 'Technical DFD', icon: Layers, path: '/processing-flow', color: 'blue', adminOnly: true },
              ].filter(m => !m.adminOnly || user?.is_admin === 1 || user?.role === 'admin').map((item, idx) => (
                <div
                  key={item.label}
                  onClick={() => { setShowMoreMenu(false); navigate(item.path); }}
                  className={`glass-card p-4 rounded-[2rem] active-scale group flex flex-col items-center text-center animate-fade-in-up`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={`p-3 rounded-2xl bg-${item.color}-500/10 border border-${item.color}-500/20 mb-3 group-hover:scale-110 transition-transform`}>
                    <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                  </div>
                  <span className="block font-black text-slate-100 text-[13px] tracking-tight">{item.label}</span>
                  <span className="text-[9px] text-slate-500 mt-1 font-bold uppercase tracking-tighter">{item.sub}</span>
                </div>
              ))}
            </div>

            <div className="p-8 pt-2 pb-10">
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-full py-4 rounded-[1.5rem] bg-white/5 border border-white/10 text-slate-400 font-black text-sm active-scale"
              >
                CLOSE CONSOLE
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
