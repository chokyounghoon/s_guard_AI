/**
 * 이름, 이메일, 전화번호 마스킹 유틸리티
 */

export function maskName(name) {
  if (!name) return '';
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + '*';
  // 3글자 이상: 첫 글자와 마지막 글자를 제외하고 모두 * 처리
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

export function maskPhone(phone) {
  if (!phone) return '';
  
  // 이미 마스킹된 경우 (서버에서 마스킹해서 내려오거나, 예외 케이스)
  if (phone.includes('*')) return phone;

  const clean = phone.replace(/[^0-9]/g, '');
  
  if (clean.length === 11) {
    if (phone.includes('-')) {
      return `${clean.slice(0,3)}-****-${clean.slice(7)}`;
    }
    return `${clean.slice(0,3)}****${clean.slice(7)}`;
  } else if (clean.length === 10) {
    if (phone.includes('-')) {
      // 02-123-4567 or 010-123-4567
      if (clean.startsWith('02')) {
        return `${clean.slice(0,2)}-****-${clean.slice(6)}`;
      }
      return `${clean.slice(0,3)}-***-${clean.slice(6)}`;
    }
    if (clean.startsWith('02')) {
      return `${clean.slice(0,2)}****${clean.slice(6)}`;
    }
    return `${clean.slice(0,3)}***${clean.slice(6)}`;
  }
  
  // 그 외의 길이나 형식인 경우, 뒤의 4자리를 마스킹
  if (phone.length > 4) {
    return phone.slice(0, phone.length - 4) + '****';
  }
  
  return phone;
}

export function maskEmail(email) {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  
  const [id, domain] = parts;
  let maskedId = id;
  
  if (id.length <= 2) {
    maskedId = id.charAt(0) + '*'.repeat(id.length - 1);
  } else {
    // 앞 2글자만 노출하고 나머지는 *
    maskedId = id.slice(0, 2) + '*'.repeat(id.length - 2);
  }
  
  return `${maskedId}@${domain}`;
}

/**
 * 🔢 오류 발생 건수 정밀 추출 유틸리티
 * - 지수 표기법(e+) 및 오버플로우된 이상값(1e+68 등) 원천 차단
 * - SMS 메시지 본문에서 '현재오류건수' > '발생건수' > '오류건수' 우선순위로 정확한 수치 추출
 */
export function extractCleanErrorCount(incidentOrCount, rawMessage) {
  let msg = '';
  let countVal = null;

  if (incidentOrCount && typeof incidentOrCount === 'object') {
    msg = incidentOrCount.message || incidentOrCount.rawMessage || incidentOrCount.description || '';
    countVal = incidentOrCount.occurrence_count;
  } else {
    countVal = incidentOrCount;
    msg = rawMessage || '';
  }

  // 1. SMS 본문 우선 정밀 분석 (실제 관제 텍스트 기반)
  if (msg) {
    // 1-1. 현재오류건수 : [7] or 현재오류건수: 7건
    const curErr = msg.match(/(?:현재\s*오류\s*건수|오류\s*발생\s*건수|발생\s*오류\s*건수)\s*[:：]?\s*\[?([0-9,]+)\s*건?\]?/i);
    if (curErr) {
      const n = parseInt(curErr[1].replace(/,/g, ''), 10);
      if (!isNaN(n) && n >= 0 && n < 1000000) return n;
    }

    // 1-2. 발생건수 : [42] or 발생건수: 42
    const occErr = msg.match(/(?:▶\s*)?발생\s*건수\s*[:：]?\s*\[?([0-9,]+)\s*건?\]?/i);
    if (occErr) {
      const n = parseInt(occErr[1].replace(/,/g, ''), 10);
      if (!isNaN(n) && n >= 0 && n < 1000000) return n;
    }

    // 1-3. 오류건수 : [15]
    const errOnly = msg.match(/(?:오류\s*건수)\s*[:：]?\s*\[?([0-9,]+)\s*건?\]?/i);
    if (errOnly) {
      const n = parseInt(errOnly[1].replace(/,/g, ''), 10);
      if (!isNaN(n) && n >= 0 && n < 1000000) return n;
    }

    // 1-4. 총 XX건
    const totalMatch = msg.match(/총\s*([0-9,]+)\s*건/i);
    if (totalMatch) {
      const n = parseInt(totalMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(n) && n > 0 && n < 1000000) return n;
    }

    // 1-5. 현재거래건수
    const curTrade = msg.match(/(?:현재\s*거래\s*건수)\s*[:：]?\s*\[?([0-9,]+)\s*건?\]?/i);
    if (curTrade) {
      const n = parseInt(curTrade[1].replace(/,/g, ''), 10);
      if (!isNaN(n) && n > 0 && n < 1000000) return n;
    }
  }

  // 2. countVal 필드 값 검증 (지수 표기법 e+, 6자리 초과 방어)
  if (countVal !== null && countVal !== undefined && countVal !== '') {
    const s = String(countVal).trim();
    if (!s.includes('e+') && !s.includes('E+') && !s.includes('e-') && s.length <= 6) {
      const num = parseInt(s.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > 0 && num < 1000000) {
        return num;
      }
    }
  }

  return 1;
}

export function formatOccurrenceCount(incidentOrCount, rawMessage) {
  const count = extractCleanErrorCount(incidentOrCount, rawMessage);
  return `${count.toLocaleString()}건`;
}

