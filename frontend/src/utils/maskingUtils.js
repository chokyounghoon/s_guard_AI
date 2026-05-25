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
