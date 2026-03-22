import React, { useState, useEffect } from 'react';
import {
  Shield, AtSign, ArrowRight, UserPlus, Lock,
  User, Phone, Building2, IdCard, ChevronDown,
  X, ScrollText, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ── 데이터 ─────────────────────────────────────────
const SHINHAN_COMPANIES = [
  '신한금융지주', '신한은행', '신한카드', '신한투자증권', '신한라이프',
  '신한캐피탈', '신한자산운용', '신한저축은행', '신한AI', '신한DS',
  '제주은행', '신한벤처투자', '신한리츠운용', '신한대체투자운용',
  '신한자산신탁', '신한펀드파트너스', '신한금융플러스', '신한큐브리스크컨설팅',
];

// 백엔드 API로부터 동적으로 로드받는 상수(하드코딩 제거)
const API_BASE = 'https://sguardai.khcho0421.workers.dev';

// ── 약관 텍스트 ────────────────────────────────────
const TERMS_OF_SERVICE = `
S-Guard AI 서비스 이용약관

제정일: 2024년 1월 1일  |  최종 개정: 2025년 3월 1일

제1조 (목적)
이 약관은 신한금융그룹 보안 관제 플랫폼 "S-Guard AI"(이하 "서비스")의 이용과 관련하여 회사와 이용자 사이의 권리·의무 및 책임사항, 서비스 이용 조건과 절차 등 기본적인 사항을 규정함을 목적으로 합니다.

제2조 (용어의 정의)
① "서비스"란 회사가 제공하는 AI 기반 지능형 보안 관제 시스템을 의미합니다.
② "이용자"란 이 약관에 동의하고 회사가 제공하는 서비스를 이용하는 신한금융그룹 임직원을 의미합니다.
③ "계정"이란 이용자가 서비스에 로그인하기 위해 사용하는 이메일 및 비밀번호의 조합을 의미합니다.

제3조 (약관의 효력 및 변경)
① 이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.
② 회사는 필요한 경우 관련 법령에 위배되지 않는 범위 내에서 이 약관을 개정할 수 있습니다.
③ 약관이 개정될 경우 회사는 최소 7일 전에 서비스 내 공지사항을 통해 이용자에게 고지합니다.

제4조 (서비스의 이용)
① 서비스는 신한금융그룹 임직원에 한해 이용이 가능합니다.
② 이용자는 자신의 계정을 타인에게 양도하거나 공유하여서는 안 됩니다.
③ 이용자는 서비스를 이용함에 있어 관련 법령, 이 약관의 규정, 회사의 정책 등을 준수하여야 합니다.

제5조 (서비스 이용 제한)
회사는 다음 각 호에 해당하는 경우 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.
① 서비스 운영을 방해하거나 보안을 위협하는 행위를 한 경우
② 허위 정보를 제공하거나 타인의 정보를 도용한 경우
③ 업무 외 목적으로 서비스를 이용한 경우

제6조 (지식재산권)
① 서비스 내의 콘텐츠, 소프트웨어, 알고리즘, AI 모델 등에 대한 지식재산권은 회사에 귀속됩니다.
② 이용자는 서비스를 통해 취득한 정보를 회사의 사전 승낙 없이 외부에 공개하거나 복제·배포할 수 없습니다.

제7조 (면책조항)
① 회사는 천재지변, 전쟁, 인터넷 장애 등 불가항력적 사유로 인해 발생한 서비스 중단에 대해 책임을 지지 않습니다.
② 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.

제8조 (분쟁해결)
이 약관과 관련된 분쟁은 대한민국 법령을 적용하며, 관할 법원은 서울중앙지방법원으로 합니다.
`;

const PRIVACY_POLICY = `
개인정보 처리방침

제정일: 2024년 1월 1일  |  최종 개정: 2025년 3월 1일

신한금융그룹 S-Guard AI 서비스(이하 "회사"라 함)는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.

1. 수집하는 개인정보의 항목
회사는 서비스 제공을 위하여 다음과 같은 개인정보를 수집합니다.
- 필수 항목: 이름, 이메일 주소, 비밀번호(암호화 저장), 사번, 소속 회사, 부문, 본부, 팀, 핸드폰 번호
- 자동 수집 항목: 서비스 이용 기록, 접속 로그, 쿠키, IP주소, 기기 정보

2. 개인정보의 수집 및 이용 목적
① 서비스 제공 및 계정 관리
② 보안 이벤트 분석 및 장애 대응
③ 서비스 이용 통계 및 품질 향상
④ 부정 이용 방지 및 보안 강화

3. 개인정보의 보유 및 이용 기간
① 수집·이용 목적이 달성된 후에는 지체 없이 파기합니다.
② 다만, 관련 법령에 의한 정보 보유 사유가 있는 경우 해당 법령에서 정한 기간 동안 보관합니다.
- 서비스 이용 기록: 3개월 (통신비밀보호법)
- 접속 기록 및 로그: 6개월 (통신비밀보호법)

4. 개인정보의 제3자 제공
회사는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우는 예외로 합니다.
- 법령에 의해 제공이 요구되는 경우
- 수사기관이 법령에 정해진 절차와 방법에 따라 개인정보를 요청하는 경우

5. 개인정보 보호 조치
회사는 개인정보를 안전하게 처리하기 위해 다음과 같은 보안 조치를 취합니다.
- 비밀번호의 암호화 저장 (SHA-256 이상 해시 + Salt)
- 전송 구간 암호화 (TLS 1.2 이상)
- 접근 권한 관리 및 로그 기록
- 보안 취약점 정기 점검

6. 개인정보 관련 권리
이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.
- 개인정보 열람, 수정, 삭제 요청
- 개인정보 처리 정지 요청

7. 개인정보 보호책임자
이름: 정보보안담당자  |  이메일: security@shinhangroup.com  |  전화: 02-000-0000

8. 개인정보 처리방침의 변경
이 처리방침은 법령·정책 또는 보안기술의 변경에 따라 내용이 추가·삭제·수정될 수 있으며, 변경 시 서비스 공지사항을 통해 안내합니다.
`;

// ── 셀렉트 + 기타 입력 컴포넌트 ───────────────────
function SelectWithOther({ label, icon: Icon, options, value, onChange, required, disabled }) {
  // "기타" 선택 여부를 독립 state로 관리
  const nonOther = options.filter(o => o !== '기타');
  const initialIsOther = !!value && !nonOther.includes(value);
  const [isOther, setIsOther] = useState(initialIsOther);
  const [otherText, setOtherText] = useState(initialIsOther ? value : '');

  const selectVal = isOther ? '기타' : (value || '');

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === '기타') {
      setIsOther(true);
      // 기타 선택 시 부모값은 기존 수기입력값 유지 (없으면 빈 문자열)
      onChange(otherText);
    } else {
      setIsOther(false);
      setOtherText('');
      onChange(v);
    }
  };

  const handleOther = (e) => {
    setOtherText(e.target.value);
    onChange(e.target.value);
  };

  const inputClass = "w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white";

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <label className="text-xs font-semibold text-slate-400 ml-1 mb-1.5 block">
        {label} {required && disabled !== true && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select
          required={required && !isOther && !disabled}
          disabled={disabled}
          value={selectVal}
          onChange={handleSelect}
          className={`${inputClass} appearance-none pr-10`}
        >
          <option value="" disabled className="bg-[#1a1f2e] text-slate-500">{disabled ? '해당없음' : `${label} 선택`}</option>

          {options.map(o => (
            <option key={o} value={o} className="bg-[#1a1f2e] text-white">{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
      {isOther && (
        <input
          required={required}
          type="text"
          value={otherText}
          onChange={handleOther}
          placeholder={`${label} 직접 입력`}
          autoFocus
          className={`${inputClass} mt-2 pl-4`}
        />
      )}
    </div>
  );
}

// ── 약관 모달 ──────────────────────────────────────
function TermsModal({ title, content, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[80vh] bg-[#12172a] border border-white/10 rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-bold text-white text-sm">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
            {content}
          </pre>
        </div>
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-all"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState(null); // 'terms' | 'privacy' | null

  // ── 조직도 동적 캐시 ──
  const [honbuList, setHonbuList] = useState([]);
  const [orgMapping, setOrgMapping] = useState({});   // depth1 → depth2[] 맵핑
  const [teamMapping, setTeamMapping] = useState({}); // depth2 → depth3[] 맵핑
  const [partMapping, setPartMapping] = useState({}); // depth3 → depth4[] 맵핑

  // ── 페이지 로드 시 조직도 자동 페치 ──
  useEffect(() => {
    fetch(`${API_BASE}/org/tree`)
      .then(r => r.json())
      .then(tree => {
        const hList = [];
        const oMap = {};
        const tMap = {};
        const pMap = {};
        tree.forEach(d1 => {
          hList.push(d1.name);
          if (d1.children && d1.children.length > 0) {
            oMap[d1.name] = d1.children.map(d2 => d2.name);
            d1.children.forEach(d2 => {
              if (d2.children && d2.children.length > 0) {
                tMap[d2.name] = d2.children.map(d3 => d3.name);
                d2.children.forEach(d3 => {
                  if (d3.children && d3.children.length > 0) {
                    pMap[d3.name] = d3.children.map(d4 => d4.name);
                  }
                });
              }
            });
          }
        });
        setHonbuList(hList);
        setOrgMapping(oMap);
        setTeamMapping(tMap);
        setPartMapping(pMap);
      })
      .catch(err => console.error('Org tree fetch failed:', err));
  }, []);

  const [formData, setFormData] = useState({
    company: '',
    employee_id: '',
    name: '',
    email: '',
    phone: '',
    honbu: '',
    team: '',
    part: '',
    subpart: '',
    password: '',
    confirmPassword: '',
  });

  const API_BASE_URL = API_BASE;

  const handleChange = (field) => (val) =>
    setFormData(prev => ({ ...prev, [field]: typeof val === 'string' ? val : val.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.company) { setErrorMsg('회사소속을 선택해 주세요.'); return; }
    if (!formData.honbu) { setErrorMsg('부문을 선택해 주세요.'); return; }
    
    // Check conditional requirements based on LIVE mapping
    const teamOptions = orgMapping[formData.honbu] || [];
    if (teamOptions.length > 0 && !formData.team) { setErrorMsg('본부를 선택해 주세요.'); return; }
    
    const partOptions = teamMapping[formData.team] || [];
    if (partOptions.length > 0 && !formData.part) { setErrorMsg('팀을 선택해 주세요.'); return; }
    
    const subpartOptions = partMapping[formData.part] || [];
    if (subpartOptions.length > 0 && !formData.subpart) { setErrorMsg('파트를 선택해 주세요.'); return; }
    
    if (formData.password !== formData.confirmPassword) { setErrorMsg('비밀번호가 일치하지 않습니다.'); return; }
    if (formData.password.length < 8) { setErrorMsg('비밀번호는 8자 이상이어야 합니다.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          company: formData.company,
          employee_id: formData.employee_id,
          phone: formData.phone,
          honbu: formData.honbu,
          team: formData.team,
          part: formData.part,
          subpart: formData.subpart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '회원가입 실패');
      localStorage.setItem('sguard_token', data.token);
      localStorage.setItem('sguard_user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-3.5 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white";
  const labelClass = "text-xs font-semibold text-slate-400 ml-1 mb-1.5 block";

  return (
    <div className="min-h-screen font-sans flex flex-col bg-[#0f111a] text-white relative overflow-hidden">
      {/* Modals */}
      {modal === 'terms' && <TermsModal title="이용약관" content={TERMS_OF_SERVICE} onClose={() => setModal(null)} />}
      {modal === 'privacy' && <TermsModal title="개인정보 처리방침" content={PRIVACY_POLICY} onClose={() => setModal(null)} />}

      {/* Background */}
      <div className="absolute inset-0 z-0 opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <div className="relative z-10 p-5 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center hover:opacity-80 transition-opacity">
          <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Shield className="w-4 h-4 text-white fill-current" />
          </div>
          <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
        </button>
        <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center space-x-1">
          <span>로그인</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 relative z-10 w-full max-w-lg mx-auto">
        <div className="text-center mb-7 w-full">
          <h1 className="text-2xl font-bold mb-2 text-white tracking-tight">계정 생성</h1>
          <p className="text-slate-400 text-sm">신한금융그룹 구성원 전용 보안 관제 시스템</p>
        </div>

        <form onSubmit={handleSignup} className="w-full space-y-4">

          {/* 회사소속 */}
          <div>
            <label className={labelClass}>회사소속 <span className="text-red-400">*</span></label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select
                required
                value={formData.company}
                onChange={handleChange('company')}
                className={`${inputClass} appearance-none pr-10`}
              >
                <option value="" disabled className="bg-[#1a1f2e] text-slate-500">회사를 선택하세요</option>
                {SHINHAN_COMPANIES.map(c => (
                  <option key={c} value={c} className="bg-[#1a1f2e] text-white">{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* 부문 / 본부 - 2열 */}
          <div className="grid grid-cols-2 gap-3">
            <SelectWithOther
              label="부문"
              icon={Building2}
              options={honbuList}
              value={formData.honbu}
              onChange={(val) => {
                handleChange('honbu')(val);
                handleChange('team')(''); // Reset team when honbu changes
                handleChange('part')(''); // Reset part also
                handleChange('subpart')(''); // Reset subpart also
              }}
              required
            />
            <SelectWithOther
              label="본부"
              icon={Building2}
              options={orgMapping[formData.honbu] || []}
              value={formData.team}
              onChange={(val) => {
                handleChange('team')(val);
                handleChange('part')(''); // Reset part when team changes
                handleChange('subpart')(''); // Reset subpart when team changes
              }}
              required={(orgMapping[formData.honbu] || []).length > 0}
              disabled={!(orgMapping[formData.honbu] || []).length > 0}
            />
          </div>

          {/* 팀 / 파트 - 2열 */}
          <div className="grid grid-cols-2 gap-3">
            <SelectWithOther
              label="팀"
              icon={Building2}
              options={teamMapping[formData.team] || []}
              value={formData.part}
              onChange={(val) => {
                handleChange('part')(val);
                handleChange('subpart')(''); // Reset subpart when team changes
              }}
              required={(teamMapping[formData.team] || []).length > 0}
              disabled={!(teamMapping[formData.team] || []).length > 0}
            />
            <SelectWithOther
              label="파트"
              icon={Building2}
              options={partMapping[formData.part] || []}
              value={formData.subpart}
              onChange={handleChange('subpart')}
              required={(partMapping[formData.part] || []).length > 0}
              disabled={!(partMapping[formData.part] || []).length > 0}
            />
          </div>

          {/* 사번 + 이름 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>사번 <span className="text-red-400">*</span></label>
              <div className="relative">
                <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="text" value={formData.employee_id} onChange={handleChange('employee_id')} placeholder="SH202400001" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>이름 <span className="text-red-400">*</span></label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="text" value={formData.name} onChange={handleChange('name')} placeholder="홍길동" className={inputClass} />
              </div>
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <label className={labelClass}>이메일 주소 <span className="text-red-400">*</span></label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input required type="email" value={formData.email} onChange={handleChange('email')} placeholder="name@shinhan.com" className={inputClass} />
            </div>
          </div>

          {/* 핸드폰 */}
          <div>
            <label className={labelClass}>핸드폰 번호 <span className="text-red-400">*</span></label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input required type="tel" value={formData.phone} onChange={handleChange('phone')} placeholder="010-0000-0000" className={inputClass} />
            </div>
          </div>

          {/* 비밀번호 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>비밀번호 <span className="text-red-400">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="password" value={formData.password} onChange={handleChange('password')} placeholder="••••••••" minLength={8} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>비밀번호 확인 <span className="text-red-400">*</span></label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input required type="password" value={formData.confirmPassword} onChange={handleChange('confirmPassword')} placeholder="••••••••" className={inputClass} />
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {errorMsg && (
            <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl px-4 py-2 border border-red-500/20">{errorMsg}</p>
          )}

          {/* 약관 동의 */}
          <div className="flex items-start space-x-2 pt-1">
            <input type="checkbox" id="terms" required className="mt-0.5 rounded border-blue-500/30 bg-[#1a1f2e] text-blue-600 focus:ring-blue-500 shrink-0" />
            <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed">
              <button type="button" onClick={() => setModal('terms')}
                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 transition-colors">
                <ScrollText className="w-3 h-3" />이용약관
              </button>
              {' '}및{' '}
              <button type="button" onClick={() => setModal('privacy')}
                className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-0.5 transition-colors">
                <FileText className="w-3 h-3" />개인정보 처리방침
              </button>
              에 동의합니다 <span className="text-red-400">*</span>
            </label>
          </div>

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98] mt-2"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>처리 중...</span></>
              : <><span>가입 완료</span><UserPlus className="w-5 h-5" /></>
            }
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          이미 계정이 있으신가요?{' '}
          <span onClick={() => navigate('/')} className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 transition-colors">로그인</span>
        </div>
      </div>

      <div className="relative z-10 py-5 w-full flex items-center justify-center opacity-30">
        <span className="text-[10px] tracking-[0.2em] font-medium text-slate-400 uppercase">Shinhan Financial Group · Secure Access</span>
      </div>
    </div>
  );
}
