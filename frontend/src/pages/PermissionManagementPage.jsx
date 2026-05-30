import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, ArrowLeft, Save, Plus, Check, X,
  AlertCircle, ChevronDown, Layout, Database,
  UserCog, History, Inbox, Activity, FileText,
  Users, Shield, Code, Eye, EyeOff, Star, RefreshCw
} from 'lucide-react';
import { getAuthHeaders, setAllowedPaths, getUserProfile } from '../lib/authStore';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { toast } from 'react-hot-toast';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// 프론트엔드에 하드코딩된 전체 메뉴 목록 (백엔드 DB에 누락된 메뉴 보완용)
const ALL_KNOWN_MENUS = [
  { menu_id: 'menu_realtime_pipeline', menu_name: 'Realtime Pipeline', path: '/realtime-pipeline', icon: 'Layers', sort_order: 10 },
  { menu_id: 'menu_orbital_command', menu_name: 'Orbital Command', path: '/orbital-command', icon: 'Cpu', sort_order: 20 },
  { menu_id: 'menu_user_keyword', menu_name: 'Personal KW', path: '/user-keyword', icon: 'Keyboard', sort_order: 30 },
  { menu_id: 'menu_report_line', menu_name: 'Report Line', path: '/report-line-management', icon: 'Users', sort_order: 40 },
  { menu_id: 'menu_user_mgmt', menu_name: 'Accounts', path: '/user-management', icon: 'User', sort_order: 50 },
  { menu_id: 'menu_security_logs', menu_name: 'Security Logs', path: '/security-logs', icon: 'Shield', sort_order: 60 },
  { menu_id: 'menu_org_mgmt', menu_name: 'Organization', path: '/organization-management', icon: 'Network', sort_order: 70 },
  { menu_id: 'menu_knowledge_base', menu_name: 'Knowledge Base', path: '/knowledge-base', icon: 'FileText', sort_order: 80 },
  { menu_id: 'menu_overall_status', menu_name: 'Global Stats', path: '/overall-status', icon: 'Activity', sort_order: 90 },
  { menu_id: 'menu_warroom', menu_name: 'War-Room Hub', path: '/warroom-management', icon: 'Shield', sort_order: 100 },
  { menu_id: 'menu_codebook', menu_name: 'Codebook', path: '/codebook-management', icon: 'BookOpen', sort_order: 110 },
  { menu_id: 'menu_processing_flow', menu_name: 'Data Flow', path: '/processing-flow', icon: 'Layers', sort_order: 120 },
  { menu_id: 'menu_push_diagnostic', menu_name: 'Push Diagnostic', path: '/push-diagnostic', icon: 'Bell', sort_order: 130 },
  { menu_id: 'menu_ai_report', menu_name: 'AI Report', path: '/ai-report', icon: 'FileText', sort_order: 140 },
  { menu_id: 'menu_mobile_report_search', menu_name: 'Report Search', path: '/mobile-report-search', icon: 'Search', sort_order: 150 },
  { menu_id: 'menu_scallert', menu_name: 'S-Callert', path: '/s-callert', icon: 'Phone', sort_order: 160 },
  { menu_id: 'menu_data_cleanup', menu_name: 'Data Cleanup', path: '/admin/incident-cleanup', icon: 'Trash2', sort_order: 170 },
  { menu_id: 'menu_permissions', menu_name: 'Permissions (RBAC)', path: '/admin/permissions', icon: 'Key', sort_order: 180 },
];

const mergeMissingMenus = (apiPerms) => {
  const merged = [...apiPerms];
  const existingPaths = new Set(apiPerms.map(p => p.path || p.menu_path));
  
  ALL_KNOWN_MENUS.forEach(known => {
    if (!existingPaths.has(known.path)) {
      merged.push({
        ...known,
        can_read: 0,
        can_write: 0,
        can_delete: 0
      });
    }
  });
  
  // sort_order 기준으로 정렬 (있는 경우)
  merged.sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
  return merged;
};

const ICON_MAP = {
  LayoutDashboard: Layout, Activity, Inbox, FileText,
  Users, UserCog, ShieldCheck, Database, Code, History,
};

const ROLE_COLOR = {
  SUPER_ADMIN: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  ADMIN:       { bg: 'bg-red-500/15',    border: 'border-red-500/40',    text: 'text-red-400',    dot: 'bg-red-400'    },
  ANALYST:     { bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  VIEWER:      { bg: 'bg-slate-500/15',  border: 'border-slate-500/40',  text: 'text-slate-400',  dot: 'bg-slate-400'  },
};
const defaultColor = { bg: 'bg-indigo-500/15', border: 'border-indigo-500/40', text: 'text-indigo-400', dot: 'bg-indigo-400' };

export default function PermissionManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [newRole, setNewRole] = useState({ role_code: '', role_name: '', description: '' });

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API_BASE}/rbac/roles`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.roles || [];
        setRoles(list);
        if (list.length > 0 && !selectedRole) setSelectedRole(list[0]);
      }
    } catch (e) { console.error(e); }
  };

  const fetchPermissions = async (roleCode) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rbac/permissions/${roleCode}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const augmentedData = mergeMissingMenus(data.permissions || []);
        const normalized = augmentedData.map(p => ({
          ...p,
          can_read:   p.can_read   ? 1 : 0,
          can_write:  p.can_write  ? 1 : 0,
          can_delete: p.can_delete ? 1 : 0,
        }));
        setPermissions(normalized);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchPermissionsSilent = async (roleCode) => {
    try {
      const res = await fetch(`${API_BASE}/rbac/permissions/${roleCode}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const augmentedData = mergeMissingMenus(data.permissions || []);
        const normalized = augmentedData.map(p => ({
          ...p,
          can_read:   p.can_read   ? 1 : 0,
          can_write:  p.can_write  ? 1 : 0,
          can_delete: p.can_delete ? 1 : 0,
        }));
        setPermissions(normalized);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { if (selectedRole) fetchPermissions(selectedRole.role_code); }, [selectedRole]);

  const savePermissions = async (permsToSave) => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/rbac/permissions`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_code: selectedRole.role_code, permissions: permsToSave }),
      });
      if (res.ok) {
        toast.success('권한이 실시간 변경/저장되었습니다!', {
          style: { background: '#0f172a', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }
        });
        const u = getUserProfile();
        if (u && u.role && u.role.toUpperCase() === selectedRole.role_code.toUpperCase()) {
          const paths = permsToSave
            .filter(p => p.can_read === 1)
            .map(p => p.path || p.menu_path)
            .filter(Boolean);
          setAllowedPaths(paths.length > 0 ? paths : null);
        }
        fetchPermissionsSilent(selectedRole.role_code);
      } else {
        toast.error('저장 실패: 서버 오류');
      }
    } catch (e) { toast.error('저장 실패'); }
    finally { setSaving(false); }
  };

  // Toggle screen visibility (can_read = screen access)
  const handleToggleScreen = (menuId) => {
    const nextPerms = permissions.map(p =>
      p.menu_id === menuId ? { ...p, can_read: p.can_read ? 0 : 1 } : p
    );
    setPermissions(nextPerms);
    savePermissions(nextPerms);
  };

  const toggleAll = (value) => {
    const nextPerms = permissions.map(p => ({ ...p, can_read: value }));
    setPermissions(nextPerms);
    savePermissions(nextPerms);
  };

  const createRole = async () => {
    if (!newRole.role_code || !newRole.role_name) return;
    try {
      const res = await fetch(`${API_BASE}/rbac/roles`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole),
      });
      if (res.ok) {
        toast.success('새 역할이 추가되었습니다.');
        setShowRoleModal(false);
        setNewRole({ role_code: '', role_name: '', description: '' });
        fetchRoles();
      }
    } catch (e) { console.error(e); }
  };

  const roleColor = selectedRole ? (ROLE_COLOR[selectedRole.role_code] || defaultColor) : defaultColor;
  const visibleCount = permissions.filter(p => p.can_read === 1).length;

  return (
    <div className="flex flex-col bg-[#07090f] text-white" style={{ minHeight: '100%', height: '100%' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#07090f]/95 backdrop-blur-xl border-b border-white/5 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/8">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </button>
            <div>
              <h1 className="text-base font-black tracking-tight">화면 권한 관리</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">RBAC · Screen Access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => selectedRole && fetchPermissions(selectedRole.role_code)}
              disabled={loading || !selectedRole}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-black">
              <Plus className="w-3.5 h-3.5" /> 역할 추가
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="px-4 pt-4 pb-4 space-y-4">
        {/* Role Selector */}
        <button onClick={() => setShowRoleSheet(true)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border ${roleColor.bg} ${roleColor.border} transition-all active:scale-[0.98]`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${roleColor.dot} shadow-lg`} />
            <div className="text-left">
              <p className={`text-sm font-black ${roleColor.text}`}>{selectedRole?.role_name || '역할 선택'}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedRole?.role_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!loading && selectedRole && (
              <span className="text-[10px] font-black text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                {visibleCount}/{permissions.length} 허용
              </span>
            )}
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </div>
        </button>

        {/* Selected role description */}
        {selectedRole?.description && (
          <p className="text-xs text-slate-500 px-1 leading-relaxed">{selectedRole.description}</p>
        )}

        {/* Quick controls */}
        {selectedRole && !loading && (
          <div className="flex gap-2">
            <button onClick={() => toggleAll(1)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 text-xs font-black">
              <Eye className="w-3.5 h-3.5" /> 전체 허용
            </button>
            <button onClick={() => toggleAll(0)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 text-xs font-black">
              <EyeOff className="w-3.5 h-3.5" /> 전체 차단
            </button>
          </div>
        )}

        {/* Screen Permission Cards */}
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs text-slate-500 animate-pulse">권한 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">접근 가능 화면 설정</p>
            {permissions.map(p => {
              const IconComp = ICON_MAP[p.icon] || Layout;
              const allowed = p.can_read === 1;
              return (
                <button key={p.menu_id} onClick={() => handleToggleScreen(p.menu_id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                    allowed
                      ? 'bg-emerald-500/8 border-emerald-500/25'
                      : 'bg-white/[0.02] border-white/5'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      allowed
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/8 text-slate-600'
                    }`}>
                      <IconComp className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                    </div>
                    <div className="text-left">
                      <p className={`text-sm font-bold ${allowed ? 'text-white' : 'text-slate-500'}`}>{p.menu_name}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{p.path}</p>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full border transition-all relative ${
                    allowed ? 'bg-emerald-500 border-emerald-400' : 'bg-white/5 border-white/10'
                  }`}>
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${
                      allowed ? 'left-6' : 'left-0.5'
                    }`} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Role Select Bottom Sheet */}
      {showRoleSheet && createPortal(
        <div className="fixed inset-0 z-[110] flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowRoleSheet(false)} />
          <div className="relative w-full bg-[#0c1018] border-t border-white/10 rounded-t-[2rem] z-10 pb-[env(safe-area-inset-bottom,16px)]">
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-black text-white">역할 선택</h3>
              <button onClick={() => setShowRoleSheet(false)} className="p-1.5 rounded-lg bg-white/5 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 pb-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {roles.map(role => {
                const c = ROLE_COLOR[role.role_code] || defaultColor;
                const isSelected = selectedRole?.role_code === role.role_code;
                return (
                  <button key={role.role_code}
                    onClick={() => { setSelectedRole(role); setShowRoleSheet(false); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                      isSelected ? `${c.bg} ${c.border}` : 'bg-white/[0.03] border-white/5'
                    }`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.bg} border ${c.border}`}>
                      {role.role_code === 'SUPER_ADMIN' ? <Star className={`w-4 h-4 ${c.text}`} /> : <Shield className={`w-4 h-4 ${c.text}`} />}
                    </div>
                    <div className="text-left flex-1">
                      <p className={`text-sm font-bold ${isSelected ? c.text : 'text-slate-300'}`}>{role.role_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{role.role_code}</p>
                    </div>
                    {isSelected && <Check className={`w-4 h-4 ${c.text}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Role Modal */}
      {showRoleModal && createPortal(
        <div className="fixed inset-0 z-[120] flex items-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowRoleModal(false)} />
          <div className="relative w-full bg-[#0e1118] border-t border-white/10 rounded-t-[2rem] z-10 pb-[env(safe-area-inset-bottom,16px)]">
            <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-black text-white">새 역할 추가</h3>
                <button onClick={() => setShowRoleModal(false)} className="p-1.5 rounded-lg bg-white/5 text-slate-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">역할 코드</label>
                <input type="text" value={newRole.role_code}
                  onChange={e => setNewRole({...newRole, role_code: e.target.value.toUpperCase()})}
                  placeholder="예: OPERATOR"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">역할 이름</label>
                <input type="text" value={newRole.role_name}
                  onChange={e => setNewRole({...newRole, role_name: e.target.value})}
                  placeholder="예: 시스템 운영자"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">설명</label>
                <textarea value={newRole.description}
                  onChange={e => setNewRole({...newRole, description: e.target.value})}
                  placeholder="역할에 대한 간략한 설명..."
                  className="w-full h-20 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-indigo-500/50" />
              </div>
              <div className="flex gap-3 pb-2">
                <button onClick={() => setShowRoleModal(false)}
                  className="flex-1 py-3.5 rounded-xl bg-white/5 border border-white/5 text-slate-400 font-black text-sm">취소</button>
                <button onClick={createRole} disabled={!newRole.role_code || !newRole.role_name}
                  className="flex-[2] py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-sm">역할 생성</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


