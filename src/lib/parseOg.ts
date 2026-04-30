interface OgData {
  title: string;
  company: string;
  postedDate: string;
  updatedDate: string;
  deadlineDate: string;
  deadlineText: string;
}

const PROXIES = [
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
];

async function fetchHtml(url: string): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim().startsWith('{')) {
        const json = JSON.parse(text) as { contents?: string };
        if (json.contents) return json.contents;
      } else if (text.includes('<html') || text.includes('<meta')) {
        return text;
      }
    } catch {
      // try next proxy
    }
  }
  return '';
}

function getOgMeta(html: string, property: string): string {
  const m =
    html.match(new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function getNameMeta(html: string, name: string): string {
  const m =
    html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1].trim() : '';
}

function extractDate(text: string): string {
  const m = text.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/**
 * 회사명과 제목을 분리:
 * - "제목 | 회사명" 패턴 (펄어비스, 넥슨 등 회사 직접 채용 페이지)
 * - "[회사명] 나머지" 패턴 (게임잡)
 * - 그 외 → 제목 그대로, 회사명 빈 문자열
 */
function parseCompanyAndTitle(rawTitle: string): { company: string; title: string } {
  // "... | 회사명" 패턴: 마지막 파이프 뒤가 회사명
  const pipeIdx = rawTitle.lastIndexOf(' | ');
  if (pipeIdx !== -1) {
    const company = rawTitle.slice(pipeIdx + 3).trim();
    const title = rawTitle.slice(0, pipeIdx).trim();
    return { company, title };
  }

  // "[회사명] 나머지" 패턴: 첫 번째 [] 내용이 회사명인 경우
  const bracketMatch = rawTitle.match(/^\[([^\]]+)\]\s*(.*)/);
  if (bracketMatch) {
    // 프로그램 유형 키워드면 회사명이 아님 (인턴십, 신입, 경력, 계약직 등)
    const PROGRAM_KEYWORDS = ['인턴', '신입', '경력', '계약', '파견', '아르바이트', '정규'];
    const candidate = bracketMatch[1];
    const isProgramType = PROGRAM_KEYWORDS.some((kw) => candidate.includes(kw));
    if (!isProgramType) {
      return { company: candidate.trim(), title: bracketMatch[2].trim() };
    }
  }

  return { company: '', title: rawTitle };
}

export async function parseOgFromUrl(url: string): Promise<OgData> {
  const empty: OgData = { title: '', company: '', postedDate: '', updatedDate: '', deadlineDate: '', deadlineText: '' };
  try {
    const html = await fetchHtml(url);
    if (!html) return empty;

    const ogTitle = getOgMeta(html, 'title') || getNameMeta(html, 'title') || '';
    const ogSiteName = getOgMeta(html, 'site_name') || '';

    let title = ogTitle;
    let company = ogSiteName;

    if (!company && ogTitle) {
      const parsed = parseCompanyAndTitle(ogTitle);
      company = parsed.company;
      title = parsed.title || ogTitle;
    }

    // 등록일 (gamejob 전용)
    const postedMatch = html.match(/class=["']date["'][^>]*>(\d{4}-\d{2}-\d{2})[^<]*등록/i);
    const postedDate = postedMatch ? postedMatch[1] : '';

    // 수정일/갱신일 (gamejob 전용)
    const updatedMatch = html.match(/class=["']date["'][^>]*>(\d{4}-\d{2}-\d{2})[^<]*수정/i);
    const updatedDate = updatedMatch ? updatedMatch[1] : '';

    // 마감일 (gamejob 전용)
    const deadlineTagMatch = html.match(/class=["']end-date["'][^>]*>([^<]+)</i);
    const deadlineRaw = deadlineTagMatch ? deadlineTagMatch[1].trim() : '';
    const deadlineDate = extractDate(deadlineRaw);
    const deadlineText = deadlineRaw && !extractDate(deadlineRaw) ? deadlineRaw : '';

    return { title, company, postedDate, updatedDate, deadlineDate, deadlineText };
  } catch {
    return empty;
  }
}
