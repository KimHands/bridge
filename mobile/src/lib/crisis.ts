// 위기(자살·자해) 상황 연계 자산 — 자가평가 결과·챗봇에서 공유.
// 백엔드 chat_guard.py의 전문기관 번호와 일치시킨다.
import { Platform } from 'react-native';

export interface Hotline {
  label: string;
  number: string; // tel: 링크에 쓰는 숫자(하이픈 포함 가능)
}

export const CRISIS_HOTLINES: Hotline[] = [
  { label: '자살예방상담', number: '1393' },
  { label: '정신건강위기상담', number: '1577-0199' },
];

// 외부 지도 앱에서 "내 주변 정신건강의학과" 검색 딥링크.
export const HOSPITAL_MAP_QUERY = Platform.select({
  ios: 'http://maps.apple.com/?q=내 주변 정신건강의학과',
  android: 'geo:0,0?q=내 주변 정신건강의학과',
  default: 'https://www.google.com/maps/search/내 주변 정신건강의학과',
})!;
