import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  ChevronLeft, Plus, Edit3, Trash2, Building2, GitMerge,
  Users, Save, X, Network, Search, Command, User, Loader2, ChevronRight
} from 'lucide-react';
import { getAccessToken } from '../lib/authStore';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const DEPTH_CONFIG = [
  { label: '회사',    icon: Building2, color: '#60a5fa' },
  { label: '부문/실', icon: Network,   color: '#a78bfa' },
  { label: '본부',   icon: GitMerge,  color: '#34d399' },
  { label: '팀',     icon: Users,     color: '#818cf8' },
  { label: '파트',   icon: Users,     color: '#93c5fd' },
];

export default function OrganizationManagementPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeDepth, setActiveDepth] = useState(0); // 현재 보고 있는 depth 탭 (0~4)

  const [selected, setSelected] = useState([null, null, null, null, null]); // depth별 선택된 id

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [modalData, setModalData] = useState({ id: null, name: '', code: '', parentId: null, depth: 1 });

  const [partUsers, setPartUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTree = () => {
    setLoading(true);
    const token = getAccessToken();
    fetch(`${API_BASE}/org/tree`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setTree(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTree(); }, []);

  // 선택된 가장 하위 노드 기준으로 인원 조회
  useEffect(() => {
    const deepestId = [...selected].reverse().find(id => id !== null);
    if (!deepestId) { setPartUsers([]); return; }

    const findNode = (nodes, id) => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = findNode(n.children, id); if (f) return f; }
      }
      return null;
    };
    const node = findNode(tree, deepestId);
    if (!node?.code) { setPartUsers([]); return; }

    setLoadingUsers(true);
    const token = getAccessToken();
    fetch(`${API_BASE}/users?orgCode=${encodeURIComponent(node.code)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setPartUsers(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [selected, tree]);

  const handleSelect = (depthIdx, id) => {
    const next = [...selected];
    next[depthIdx] = id;
    // 하위 depth 초기화
    for (let i = depthIdx + 1; i < 5; i++) next[i] = null;
    setSelected(next);
    // 자동으로 다음 depth 탭으로 이동 (자식이 있는 경우)
    if (depthIdx < 4) setActiveDepth(depthIdx + 1);
  };

  // depth별 노드 목록
  const getNodes = (depth) => {
    if (depth === 0) return tree;
    const parentId = selected[depth - 1];
    if (!parentId) return [];
    const findChildren = (nodes, id) => {
      for (const n of nodes) {
        if (n.id === id) return n.children || [];
        if (n.children) { const f = findChildren(n.children, id); if (f.length > -1 && f !== null) return f; }
      }
      return [];
    };
    // Simplified: build flat arrays per depth selection
    return getNodesAtDepth(tree, depth, 0);
  };

  const getNodesAtDepth = (nodes, targetDepth, currentDepth) => {
    if (currentDepth === targetDepth) return nodes;
    const parentId = selected[currentDepth];
    if (!parentId) return [];
    const parent = nodes.find(n => n.id === parentId);
    if (!parent?.children) return [];
    return getNodesAtDepth(parent.children, targetDepth, currentDepth + 1);
  };

  const handleOpenAddModal = () => {
    const parentId = activeDepth > 0 ? selected[activeDepth - 1] : null;
    setModalMode('add');
    setModalData({ id: null, name: '', code: '', parentId, depth: activeDepth + 1 });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node) => {
    setModalMode('edit');
    setModalData({ id: node.id, name: node.name, code: node.code || '', parentId: node.parent_id, depth: node.depth });
    setIsModalOpen(true);
  };

  const handleSaveNode = async () => {
    if (!modalData.name.trim()) { alert('조직명을 입력하세요.'); return; }
    setSaving(true);
    try {
      const token = getAccessToken();
      const url = modalMode === 'add'
        ? `${API_BASE}/org/nodes`
        : `${API_BASE}/org/nodes/${modalData.id}`;
      const method = modalMode === 'add' ? 'POST' : 'PATCH';
      const body = modalMode === 'add'
        ? { name: modalData.name, code: modalData.code, parent_id: modalData.parentId, depth: modalData.depth, sort_order: 0 }
        : { name: modalData.name, code: modalData.code };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (res.ok) { fetchTree(); setIsModalOpen(false); }
      else { const e = await res.json().catch(() => ({})); alert(`실패: ${e.detail || '서버 오류'}`); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDeleteNode = async (nodeId, e) => {
    e.stopPropagation();
    if (!window.confirm('삭제하면 하위 조직도 모두 삭제됩니다.')) return;
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/org/nodes/${nodeId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (res.ok) {
      // 삭제된 depth부터 하위 초기화
      const depthIdx = activeDepth;
      const next = [...selected];
      for (let i = depthIdx; i < 5; i++) next[i] = null;
      setSelected(next);
      fetchTree();
    }
  };

  const currentNodes = [...getNodes(activeDepth)]
    .filter(n =>
      !search || n.name.toLowerCase().includes(search.toLowerCase()) || (n.code || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => b.id - a.id);

  const cfg = DEPTH_CONFIG[activeDepth];
  const Icon = cfg.icon;

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100dvh', display: 'flex', flexDirection: 'column', overflowY: 'auto',
      background: 'linear-gradient(160deg, #060a18 0%, #0a0f20 60%, #060a18 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>

      {/* ①  헤더 */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px',
        borderBottom: '1px solid rgba(59,130,246,0.1)',
        background: 'rgba(6,10,24,0.95)', backdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => goBack()} style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <ChevronLeft size={18} color="#64748b" />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 16, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #60a5fa, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>조직 구조 관리</div>
          <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.7 }}>
            5-DEPTH ORG ADMIN
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          disabled={activeDepth > 0 && !selected[activeDepth - 1]}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            opacity: activeDepth > 0 && !selected[activeDepth - 1] ? 0.4 : 1,
          }}>
          <Plus size={18} color="#60a5fa" />
        </button>
      </header>

      {/* ②  검색 바 */}
      <div style={{ flexShrink: 0, padding: '10px 16px 0', position: 'relative' }}>
        <Search size={15} color="#475569" style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-30%)' }} />
        <input
          type="text"
          placeholder="조직명 / 코드 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '12px 14px 12px 38px',
            color: '#e2e8f0', fontSize: 15, outline: 'none',
          }}
        />
      </div>

      {/* ③  Depth 탭 네비게이션 */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 6, padding: '10px 16px 0',
        overflowX: 'auto',
      }}>
        {DEPTH_CONFIG.map((d, i) => {
          const DIcon = d.icon;
          const isActive = activeDepth === i;
          const isEnabled = i === 0 || selected[i - 1] !== null;
          return (
            <button
              key={i}
              onClick={() => isEnabled && setActiveDepth(i)}
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 10, cursor: isEnabled ? 'pointer' : 'not-allowed',
                background: isActive ? `${d.color}18` : 'rgba(255,255,255,0.03)',
                border: isActive ? `1px solid ${d.color}40` : '1px solid rgba(255,255,255,0.06)',
                opacity: isEnabled ? 1 : 0.35, transition: 'all 0.15s',
              }}
            >
              <DIcon size={13} color={isActive ? d.color : '#475569'} />
              <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? d.color : '#475569', whiteSpace: 'nowrap' }}>
                {d.label}
              </span>
              {selected[i] && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: d.color, flexShrink: 0,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ④  선택 경로 브레드크럼 */}
      {selected.some(s => s !== null) && (
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
          padding: '8px 16px 0', flexWrap: 'wrap',
        }}>
          {selected.map((id, i) => {
            if (!id) return null;
            const findNode = (nodes, targetId) => {
              for (const n of nodes) {
                if (n.id === targetId) return n;
                if (n.children) { const f = findNode(n.children, targetId); if (f) return f; }
              }
              return null;
            };
            const node = findNode(tree, id);
            return (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={11} color="#334155" />}
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: i === activeDepth - 1 ? DEPTH_CONFIG[i].color : '#475569',
                }}>
                  {node?.name || '…'}
                </span>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ⑤  노드 목록 (flex:1 스크롤) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Loader2 size={24} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : currentNodes.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: 120, border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16, gap: 8,
          }}>
            <Icon size={24} color="#1e293b" />
            <span style={{ fontSize: 13, color: '#334155', fontWeight: 700 }}>
              {activeDepth > 0 && !selected[activeDepth - 1]
                ? `먼저 ${DEPTH_CONFIG[activeDepth - 1].label}을 선택하세요`
                : '항목이 없습니다'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentNodes.map(node => {
              const isSelected = selected[activeDepth] === node.id;
              const hasChildren = node.children && node.children.length > 0;
              return (
                <div
                  key={node.id}
                  onClick={() => handleSelect(activeDepth, node.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 16, cursor: 'pointer',
                    background: isSelected ? `${cfg.color}12` : 'rgba(255,255,255,0.03)',
                    border: isSelected ? `1px solid ${cfg.color}35` : '1px solid rgba(255,255,255,0.07)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: isSelected ? `${cfg.color}20` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isSelected ? cfg.color + '35' : 'rgba(255,255,255,0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={isSelected ? cfg.color : '#475569'} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isSelected ? '#f1f5f9' : '#e2e8f0', marginBottom: 2 }}>
                      {node.name}
                    </div>
                    {node.code && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Command size={10} color="#334155" />
                        <span style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace' }}>{node.code}</span>
                        {hasChildren && (
                          <span style={{
                            fontSize: 11, color: cfg.color, marginLeft: 4, fontWeight: 700,
                            background: `${cfg.color}15`, borderRadius: 4, padding: '1px 6px',
                          }}>
                            {node.children.length}개
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleOpenEditModal(node); }}
                      style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}>
                      <Edit3 size={13} color="#64748b" />
                    </button>
                    <button
                      onClick={e => handleDeleteNode(node.id, e)}
                      style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      }}>
                      <Trash2 size={13} color="#f87171" />
                    </button>
                  </div>

                  {isSelected && activeDepth < 4 && (
                    <ChevronRight size={16} color={cfg.color} style={{ flexShrink: 0 }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 인원 목록 (파트 선택 시) */}
        {selected[4] && activeDepth === 4 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={15} color="#60a5fa" />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0' }}>소속 인원</span>
              <span style={{
                fontSize: 12, color: '#60a5fa', fontWeight: 800,
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: 6, padding: '1px 8px',
              }}>{partUsers.length}명</span>
            </div>
            {loadingUsers ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <Loader2 size={20} color="#475569" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : partUsers.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {partUsers.map((u, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 12px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 900, color: '#60a5fa',
                    }}>{u.name?.[0]}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.position || u.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: 'center', padding: '20px', fontSize: 13, color: '#334155',
                border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 14,
              }}>배정된 인원이 없습니다.</div>
            )}
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 350,
          display: 'flex', alignItems: 'flex-end',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        }} onClick={() => setIsModalOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', padding: '24px 20px 64px',
              background: 'linear-gradient(180deg, #0f172a, #0a0e1a)',
              borderRadius: '24px 24px 0 0',
              border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9' }}>
                  {modalMode === 'add' ? '조직 추가' : '조직 수정'}
                </div>
                <div style={{ fontSize: 12, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>
                  {DEPTH_CONFIG[activeDepth].label} · Depth {activeDepth + 1}
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <X size={16} color="#64748b" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', marginBottom: 6 }}>조직명</div>
                <input
                  autoFocus type="text" placeholder="예: 경영기획본부"
                  value={modalData.name}
                  onChange={e => setModalData({ ...modalData, name: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, padding: '14px 16px', color: '#f1f5f9',
                    fontSize: 16, outline: 'none',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', marginBottom: 6 }}>조직 코드 (선택)</div>
                <input
                  type="text" placeholder="예: ORG-001"
                  value={modalData.code}
                  onChange={e => setModalData({ ...modalData, code: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, padding: '14px 16px', color: '#f1f5f9',
                    fontSize: 16, fontFamily: 'monospace', outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handleSaveNode}
                disabled={saving}
                style={{
                  marginTop: 4, width: '100%', padding: '16px',
                  borderRadius: 14, fontWeight: 900, fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  boxShadow: '0 0 24px rgba(59,130,246,0.3)',
                }}>
                {saving
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 저장 중...</>
                  : <><Save size={16} /> 저장하기</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #1e293b; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.2); border-radius: 99px; }
      `}</style>
    </div>
  );
}
