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

    // 사이트별 셀렉터로 먼저 시도 (정확도 ↑)
    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return ''; }
    })();

    let postedDate = '';
    let updatedDate = '';
    let deadlineDate = '';
    let deadlineText = '';

    if (hostname.includes('gamejob')) {
      // gamejob 전용 셀렉터
      const postedMatch = html.match(/class=["']date["'][^>]*>(\d{4}-\d{2}-\d{2})[^<]*등록/i);
      postedDate = postedMatch ? postedMatch[1] : '';

      const updatedMatch = html.match(/class=["']date["'][^>]*>(\d{4}-\d{2}-\d{2})[^<]*수정/i);
      updatedDate = updatedMatch ? updatedMatch[1] : '';

      const deadlineTagMatch = html.match(/class=["']end-date["'][^>]*>([^<]+)</i);
      const deadlineRaw = deadlineTagMatch ? deadlineTagMatch[1].trim() : '';
      deadlineDate = extractDate(deadlineRaw);
      deadlineText = deadlineRaw && !extractDate(deadlineRaw) ? deadlineRaw : '';
    } else {
      // 범용 한국어 패턴 (펄어비스 같은 일반 채용 페이지)
      // 날짜 정규식: YYYY.MM.DD / YYYY-MM-DD / YYYY/MM/DD
      const dateRe = /(\d{4})[./-](\d{1,2})[./-](\d{1,2})/;
      const norm = (m: RegExpMatchArray | null) =>
        m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';

      // 등록일/공고일/게시일
      const postedM = html.match(/(?:등록일|공고일|게시일|작성일|발행일)[\s:：]*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/i);
      postedDate = norm(postedM);

      // 수정일/갱신일
      const updatedM = html.match(/(?:수정일|갱신일|업데이트일)[\s:：]*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/i);
      updatedDate = norm(updatedM);

      // 마감일 (단일 날짜)
      const deadlineM = html.match(/(?:마감일|마감)[\s:：]*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/i);
      deadlineDate = norm(deadlineM);

      // 지원기간: YYYY.MM.DD ~ YYYY.MM.DD → posted=시작, deadline=끝
      if (!deadlineDate || !postedDate) {
        const rangeM = html.match(/(?:지원기간|모집기간|채용기간|접수기간)[\s:：]*(\d{4})[./-](\d{1,2})[./-](\d{1,2})\s*[~∼~\-–]\s*(\d{4})[./-](\d{1,2})[./-](\d{1,2})/i);
        if (rangeM) {
          if (!postedDate) postedDate = `${rangeM[1]}-${rangeM[2].padStart(2, '0')}-${rangeM[3].padStart(2, '0')}`;
          if (!deadlineDate) deadlineDate = `${rangeM[4]}-${rangeM[5].padStart(2, '0')}-${rangeM[6].padStart(2, '0')}`;
        }
      }

      // 마감 텍스트 (상시채용 / 채용시 마감 등)
      if (!deadlineDate) {
        const textM = html.match(/(상시\s*채용|채용\s*시\s*마감|수시\s*채용|충원\s*시\s*마감)/);
        if (textM) deadlineText = textM[1].replace(/\s+/g, ' ').trim();
      }

      // 마지막 보루: 임의 날짜 추출 시도하지 않음 (오탐 위험)
      void dateRe;
    }

    return { title, company, postedDate, updatedDate, deadlineDate, deadlineText };
  } catch {
    return empty;
  }
}
