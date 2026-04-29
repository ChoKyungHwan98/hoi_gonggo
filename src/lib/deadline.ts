// YYYY-MM-DD 형식을 로컬 자정으로 파싱. new Date('2026-05-01')은 UTC 자정으로
// 파싱되어 KST에서는 전날로 보일 수 있음. 'T00:00:00' 붙이면 로컬 자정.
export const parseLocalDate = (dateStr: string): Date => new Date(dateStr + 'T00:00:00');

const todayLocalMidnight = (): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const daysUntil = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  return Math.ceil((parseLocalDate(dateStr).getTime() - todayLocalMidnight()) / 86400000);
};

export const deadlineUrgency = (dateStr: string | null): 'urgent' | 'soon' | null => {
  const diff = daysUntil(dateStr);
  if (diff === null || diff < 0) return null;
  if (diff <= 3) return 'urgent';
  if (diff <= 7) return 'soon';
  return null;
};

export const getDday = (dateStr: string | null): string | null => {
  const diff = daysUntil(dateStr);
  if (diff === null) return null;
  if (diff < 0) return '마감';
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
};

export const isExpired = (dateStr: string | null): boolean => {
  const diff = daysUntil(dateStr);
  return diff !== null && diff < 0;
};
