// 루틴 title → emoji placeholder 매핑.
// 더 구체적인 키워드(스트레칭/산책/일기 등)를 일반 키워드(취침/명상)보다 먼저 매치.
export function routineEmoji(title: string): string {
  if (title.includes('스트레칭')) return '🤸';
  if (title.includes('산책') || title.includes('걷')) return '🚶';
  if (title.includes('일기') || title.includes('적기') || title.includes('적어')) return '📓';
  if (title.includes('독서') || title.includes('책')) return '📚';
  if (title.includes('명상') || title.includes('호흡') || title.includes('마음')) return '🧘';
  if (title.includes('물') || title.includes('수분')) return '💧';
  if (title.includes('수면') || title.includes('취침') || title.includes('잠')) return '🌙';
  return '✨';
}
