import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../hooks/useBackNavigation';
import {
  Shield, ShieldAlert, Download, Search,
  RefreshCw, Globe, Monitor, ChevronLeft, Loader2, CheckCircle, XCircle
} from 'lucide-react';

const API_BASE = 'https://sguardai.khcho0421.workers.dev';

const SecurityLogPage = () => {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/dashboard');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/security/logs`);
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

  useEffect(() => { fetchLogs(); }, []);

  const handleDownloadCSV = () => {
    if (logs.length === 0) return;
    const headers = ['접속시간', '사번', '이름', '이메일', 'IP 주소', '상태', '접속 환경'];
    const rows = logs.map(log => [
      new Date(log.login_time).toLocaleString('ko-KR'),
      log.user_id, log.user_name || 'N/A', log.email,
      log.ip_address, log.status,
      (log.user_agent || '').replace(/,/g, ' '),
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SGUARD_SecurityLog_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const filtered = logs.filter(log =>
    (log.user_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.ip_address || '').includes(searchTerm) ||
    (log.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueIPs = new Set(logs.map(l => l.ip_address)).size;
  const failures = logs.filter(l => l.status === 'FAILURE').length;

  const fmtDate = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #050812 0%, #080d1c 60%, #050812 100%)',
      fontFamily: "'Pretendard', 'Inter', sans-serif", color: '#cbd5e1',
    }}>

      {/* ①  헤더 */}
      <header style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px',
        borderBottom: '1px solid rgba(99,102,241,0.12)',
        background: 'rgba(5,8,18,0.95)', backdropFilter: 'blur(20px)',
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
            fontSize: 18, fontWeight: 900, letterSpacing: '0.04em',
            background: 'linear-gradient(90deg, #818cf8, #6366f1)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Security Logs</div>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 800, letterSpacing: '0.15em', opacity: 0.6 }}>
            ACCESS AUDIT TRAILS
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchLogs} disabled={loading} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <RefreshCw size={15} color="#64748b" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={handleDownloadCSV} style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <Download size={15} color="#818cf8" />
          </button>
        </div>
      </header>

      {/* ②  통계 카드 3개 */}
      <div style={{
        flexShrink: 0,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8, padding: '10px 16px 0',
      }}>
        {[
          { label: 'TOTAL', value: logs.length, unit: '건', color: '#818cf8', icon: Shield },
          { label: 'UNIQUE IP', value: uniqueIPs, unit: '개', color: '#34d399', icon: Globe },
          { label: 'FAILURE', value: failures, unit: '건', color: '#f87171', icon: ShieldAlert },
        ].map(({ label, value, unit, color, icon: Icon }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color, fontFamily: 'monospace' }}>{loading ? '…' : value}</span>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ③  검색 바 */}
      <div style={{ flexShrink: 0, padding: '10px 16px 0', position: 'relative' }}>
        <Search size={15} color="#475569" style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-30%)' }} />
        <input
          type="text"
          placeholder="사번 · 이름 · IP 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '11px 14px 11px 36px',
            color: '#e2e8f0', fontSize: 14, outline: 'none',
          }}
        />
      </div>

      {/* ④  로그 카드 목록 (flex:1 스크롤) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Loader2 size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <Shield size={32} color="#1e293b" />
            <span style={{ fontSize: 14, color: '#334155', fontWeight: 700 }}>검색 결과 없음</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((log, i) => {
              const isSuccess = log.status === 'SUCCESS';
              const statusColor = isSuccess ? '#10b981' : '#f87171';
              const ua = (log.user_agent || '').substring(0, 60);
              return (
                <div key={log.id || i} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 16, padding: '13px 14px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* 왼쪽 상태 바 */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                    background: statusColor, borderRadius: '16px 0 0 16px',
                  }} />

                  {/* 1행: 상태 배지 + 날짜 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 800,
                      color: statusColor,
                      background: `${statusColor}15`,
                      border: `1px solid ${statusColor}30`,
                      borderRadius: 6, padding: '4px 10px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {isSuccess
                        ? <><CheckCircle size={10} /> 정상 승인</>
                        : <><XCircle size={10} /> 차단됨</>}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', fontWeight: 700 }}>
                      {fmtDate(log.login_time)}
                    </span>
                  </div>

                  {/* 2행: 사용자 이름 + 사번 */}
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>
                      {log.user_name || '미인증 접근'}
                    </span>
                    {log.user_id && (
                      <span style={{ fontSize: 12, color: '#475569', marginLeft: 8, fontFamily: 'monospace' }}>
                        {log.user_id}
                      </span>
                    )}
                  </div>

                  {/* 3행: IP + 디바이스 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <Globe size={11} color="#6366f1" />
                      <code style={{
                        fontSize: 14, color: '#818cf8',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 5, padding: '2px 8px',
                      }}>
                        {log.ip_address}
                      </code>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <Monitor size={11} color="#475569" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ua}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ⑤  하단 법적 고지 */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px 12px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <Shield size={10} color="#1e293b" />
        <span style={{ fontSize: 10, color: '#1e293b', lineHeight: 1.4 }}>
          접속 로그는 보안 정책에 따라 5년간 보관됩니다.
        </span>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #334155; }
        input:focus { border-color: rgba(99,102,241,0.35) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default SecurityLogPage;
