#!/usr/bin/env node
/**
 * 모바일 계정/승격 화면 사용자 노출 문구의 도메인 금지어 가드.
 *
 * 백엔드 app/services/notification.py 의 assert_domain_safe(_BANNED_TERMS)에
 * 대응하는 모바일 측 가드다. 모바일에는 테스트 러너가 없어 standalone 스크립트로
 * 두고 `npm run check:copy`(및 CI)에서 실행한다.
 *
 * 스코프: 계정/인증 copy 화면(Login·Signup·Upgrade)만. PHQ 자가평가 문항·감정
 * 키워드('우울한' 등)가 있는 화면(Assessment·Onboarding 등)은 정당한 임상/정서
 * 어휘가 금지어에 부분일치해 오탐이 나므로 제외한다.
 */
const fs = require('fs');
const path = require('path');

// 백엔드 _BANNED_TERMS와 동기화(변경 시 양쪽 함께 갱신)
const BANNED = [
  '치료', '진단', '개선', '효과', '장애', '병원', '의사',
  '우울', '중등도', 'PHQ', 'GAD', '구간', '점수', '상담', '처방', '자살', '자해',
];

const AUTH_DIR = path.join(__dirname, '..', 'src', 'screens', 'auth');
const TARGETS = ['LoginScreen.tsx', 'SignupScreen.tsx', 'UpgradeScreen.tsx'].map((f) =>
  path.join(AUTH_DIR, f)
);

// 문자열 리터럴(작은/큰따옴표·백틱)만 추출 — 식별자/주석 오탐을 줄인다
const STRING_RE = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;

const violations = [];
for (const file of TARGETS) {
  const src = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = STRING_RE.exec(src)) !== null) {
    const s = m[1] ?? m[2] ?? m[3] ?? '';
    for (const term of BANNED) {
      if (s.includes(term)) {
        violations.push({ file: path.basename(file), term, text: s });
      }
    }
  }
}

if (violations.length) {
  console.error('도메인 금지어 발견:');
  for (const v of violations) {
    console.error(`  [${v.file}] '${v.term}' → "${v.text}"`);
  }
  process.exit(1);
}
console.log(`OK — auth copy ${TARGETS.length}개 화면에 도메인 금지어 없음`);
