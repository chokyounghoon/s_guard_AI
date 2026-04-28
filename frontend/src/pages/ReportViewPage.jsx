import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScrollText, Clock, User, Printer,
  CheckCircle, MessageSquare, ChevronRight, Building2
} from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';
import BottomMenu from '../components/BottomMenu';

const getApiUrl = (path) => `https://sguardai.khcho0421.workers.dev${path}`;

export default function ReportViewPage() {
  const { incId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgTree, setOrgTree] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  const getAccessToken = () => {
    try {
      return localStorage.getItem('sguard_access_token');
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(getApiUrl(`/reports/${incId}`));
        if (!res.ok) throw new Error('보고서를 찾을 수 없습니다');
        const data = await res.json();
        
        let reportData = data.report || {};

        try {
          const token = getAccessToken();
          const cleanId = String(incId || '').replace(/^INC-/i, '');
          
          let smsRes = await fetch(getApiUrl(`/sms/${cleanId}`), {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          
          if (!smsRes.ok) {
            smsRes = await fetch(getApiUrl(`/sms/${incId}`), {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
          }

          if (smsRes.ok) {
            const smsData = await smsRes.json();
            if (smsData) {
              // Merge all SMS data columns
              reportData = { ...reportData, ...smsData };
              if (smsData.message) {
                reportData.sms_message = smsData.message;
              }
            }
          }
        } catch (smsErr) {
          console.error("Failed to fetch real SMS in sequence:", smsErr);
        }

        setReport(reportData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchOrg_ = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(getApiUrl('/org/tree'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setOrgTree(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to fetch org tree:", e);
      }
    };

    const fetchUsers_ = async () => {
      try {
        const token = getAccessToken();
        const res = await fetch(getApiUrl('/users'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to fetch users:", e);
      }
    };

    if (incId) {
      fetch_();
      fetchOrg_();
      fetchUsers_();
    }
  }, [incId]);

  const cleanId = String(incId || '').replace(/^INC-/i, '');
  const cleanTitle = (t) => (t || '').split(':')[0].trim();

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#090c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(16,185,129,0.15)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#475569', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>리포트 불러오는 중...</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div style={{ minHeight: '100dvh', background: '#090c14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ width: 60, height: 60, borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ScrollText size={26} color="#334155" />
      </div>
      <p style={{ color: '#64748b', fontSize: 14 }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ padding: '10px 24px', borderRadius: 12, background: '#1d4ed8', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
        돌아가기
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#090c14', color: '#fff', paddingBottom: 100 }}>

      {/* ── Header ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(9,12,20,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <ArrowLeft size={16} color="#94a3b8" />
        </button>

        {/* 타이틀 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 900, color: '#10b981', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>
            Incident Report
          </p>
          <p style={{ fontSize: 10, color: '#334155', fontFamily: 'monospace', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cleanId}
          </p>
        </div>

        {/* 인쇄 */}
        <button
          onClick={() => window.print()}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
          title="인쇄"
        >
          <Printer size={15} color="#64748b" />
        </button>
      </header>

      {/* ── Content ── */}
      <div style={{ paddingTop: 64, paddingInline: 16, maxWidth: 680, margin: '0 auto' }}>

        {/* Meta Card */}
        <div style={{
          marginTop: 16, marginBottom: 12,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(9,12,20,0) 60%)',
          border: '1px solid rgba(16,185,129,0.15)',
          borderRadius: 20, padding: '16px 18px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* 왼쪽 강조선 */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: '#10b981', borderRadius: '20px 0 0 20px' }} />

          {/* 상태 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)', borderRadius: 6, padding: '3px 10px', letterSpacing: '0.04em' }}>처리완료</span>
            <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', fontWeight: 800 }}>
              유사도 {report?.similarity ? (String(report.similarity).includes('%') ? report.similarity : `${report.similarity}%`) : '98.5%'}
            </span>
          </div>

          {/* 제목 & MTTR */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', lineHeight: 1.4, margin: 0 }}>
              {(() => {
                // 1. Users 테이블에서 user_id 기반 subpart 코드를 찾고, Org 테이블에서 명칭 조회
                const writer = users.find(u => 
                  String(u.user_id) === String(report?.user_id) || 
                  String(u.id) === String(report?.user_id) ||
                  (report?.user_id && String(u.name) === String(report.user_id))
                );
                const userSubpartCode = writer?.subpart || writer?.org_code || writer?.dept_code;

                const findOrgNameByCode = (nodes, code) => {
                  if (!nodes || !code) return null;
                  for (const node of nodes) {
                    if (String(node.code) === String(code)) return node.name;
                    if (node.children) {
                      const found = findOrgNameByCode(node.children, code);
                      if (found) return found;
                    }
                  }
                  return null;
                };

                const orgName = findOrgNameByCode(orgTree, userSubpartCode);
                if (orgName) {
                  return `[${orgName} 장애 완료 보고서]`;
                }

                const fallbackCode = report?.subpart_code || report?.subpart || report?.dept_code || report?.org_code;
                const fallbackOrgName = findOrgNameByCode(orgTree, fallbackCode);
                if (fallbackOrgName) {
                  return `[${fallbackOrgName} 장애 완료 보고서]`;
                }

                return cleanTitle(report?.title || `[인시던트 보고서] ${cleanId}`);
              })()}
            </h2>
            
            {/* MTTR 배지 */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
              padding: '6px 12px', borderRadius: 12,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#ef4444', fontSize: 13, fontWeight: 900,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 9, color: 'rgba(239,68,68,0.5)', fontWeight: 900, letterSpacing: '0.05em' }}>MTTR</span>
              <span style={{ fontFamily: 'monospace' }}>{report?.mttr || '12m 34s'}</span>
            </div>
          </div>

          {/* 메타 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {(report?.user_org_path || report?.user_id) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Building2 size={12} color="#475569" />
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, lineHeight: 1.5 }}>
                  {report.user_org_path || report.user_id}
                </span>
              </div>
            )}
            {report?.created_at && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Clock size={12} color="#475569" />
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {new Date(report.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 원본 문자 메시지 카드 */}
        {report?.sms_message && (
          <div style={{
            marginBottom: 20,
            background: 'rgba(59,130,246,0.04)',
            border: '1px solid rgba(59,130,246,0.15)',
            borderRadius: 20, padding: '16px 20px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: '#3b82f6', borderRadius: '20px 0 0 20px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <MessageSquare size={14} color="#60a5fa" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', letterSpacing: '0.05em' }}>수신 문자 원문</span>
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {report.sms_message || ''}
            </div>
          </div>
        )}

        {/* 리포트 본문 */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20, padding: '16px 18px',
        }}>
          {report?.content ? (
            <MarkdownViewer text={report.content} />
          ) : (
            <p style={{ color: '#475569', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>
              보고서 내용이 없습니다.
            </p>
          )}
        </div>
      </div>

      <BottomMenu />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
