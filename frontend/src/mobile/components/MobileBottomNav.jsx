import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, MessageSquare, Plus, Activity } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',      icon: LayoutDashboard, label: '대시보드' },
  { path: '/inbox',          icon: Inbox,            label: '인박스'    },
  { path: '/incident-push',  icon: Plus,             label: '장애접수', accent: true },
  { path: '/chat',           icon: MessageSquare,    label: 'War-Room'  },
  { path: '/activity',       icon: Activity,         label: '처리현황'  },
];

export default function MobileBottomNav({ currentPath }) {
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/chat') return currentPath.startsWith('/chat');
    return currentPath === path;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 글래스모피즘 배경 */}
      <div className="bg-[#0d1117]/90 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(({ path, icon: Icon, label, accent }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                id={`mobile-nav-${label}`}
                onClick={() => navigate(path)}
                className={`
                  flex flex-col items-center justify-center gap-1 
                  min-w-[56px] py-2 px-3 rounded-2xl
                  transition-all duration-200 active:scale-95
                  ${accent
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 -mt-4 border border-blue-400/40'
                    : active
                      ? 'text-blue-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                {accent ? (
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                ) : (
                  <div className="relative">
                    <Icon className={`w-6 h-6 transition-all ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.5 : 1.8} />
                    {active && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
                    )}
                  </div>
                )}
                <span className={`text-[10px] font-medium leading-tight ${accent ? 'font-bold' : ''}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
