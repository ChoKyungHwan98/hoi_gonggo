import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSaveStatus } from '../contexts/SaveStatusContext';

interface Props {
  postingId: string;
  initialKeywords: string | null;
  initialAnalysis: string | null;
  readOnly: boolean;
  onClose?: () => void;
}

const splitKeywords = (s: string | null): string[] =>
  (s ?? '').split(',').map(k => k.trim()).filter(Boolean);

const joinKeywords = (arr: string[]): string =>
  arr.length === 0 ? '' : arr.join(', ');

export default function AnalysisPanel({ postingId, initialKeywords, initialAnalysis, readOnly, onClose }: Props) {
  const [keywords, setKeywords] = useState<string[]>(splitKeywords(initialKeywords));
  const [draft, setDraft] = useState('');
  const [analysis, setAnalysis] = useState(initialAnalysis ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setStatus: setSaveStatus } = useSaveStatus();

  // 초기값은 mount 시 한 번만. realtime fetch가 typing 중에 prop을 갱신해도
  // 로컬 state를 덮어쓰지 않게 — 사용자 입력이 우선. 패널 닫고 다시 열면 fresh.

  // 패널 열리면 키워드 입력칸 자동 포커싱
  useEffect(() => {
    if (!readOnly) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [readOnly]);

  // Esc 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const persist = useCallback(async (col: 'keywords' | 'analysis', val: string | null) => {
    setSaveStatus('saving');
    const { error } = await supabase
      .from('job_postings')
      .update({ [col]: val })
      .eq('id', postingId);
    setSaveStatus(error ? 'error' : 'saved');
  }, [postingId, setSaveStatus]);

  const persistKeywords = useCallback((next: string[]) => {
    persist('keywords', next.length === 0 ? null : joinKeywords(next));
  }, [persist]);

  const addKeyword = (raw: string) => {
    const clean = raw.trim().replace(/,$/, '').trim();
    if (!clean) {
      setDraft('');
      return;
    }
    if (keywords.includes(clean)) {
      // 중복: draft만 비우고 기존 칩을 잠깐 강조하는 신호 (간단히 input 흔들기)
      setDraft('');
      const el = inputRef.current;
      if (el) {
        el.classList.remove('kw-chip__input--shake');
        // 강제 reflow로 애니메이션 재시작
        void el.offsetWidth;
        el.classList.add('kw-chip__input--shake');
      }
      return;
    }
    const next = [...keywords, clean];
    setKeywords(next);
    setDraft('');
    persistKeywords(next);
  };

  const removeKeyword = (idx: number) => {
    const next = keywords.filter((_, i) => i !== idx);
    setKeywords(next);
    persistKeywords(next);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(draft);
    } else if (e.key === 'Backspace' && draft === '' && keywords.length > 0) {
      removeKeyword(keywords.length - 1);
    }
  };

  const handleAnalysisChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setAnalysis(v);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      persist('analysis', v.trim() === '' ? null : v);
    }, 500);
  };

  return (
    <div className="analysis">
      {onClose && (
        <button className="analysis__close" onClick={onClose} title="닫기 (Esc)">
          <X size={14} />
        </button>
      )}

      <div className="analysis__section">
        <label className="analysis__label">핵심 키워드</label>
        <div className="analysis__chips">
          {keywords.map((kw, i) => (
            <span key={`${kw}-${i}`} className="kw-chip">
              {kw}
              {!readOnly && (
                <button
                  className="kw-chip__remove"
                  onClick={() => removeKeyword(i)}
                  title="삭제"
                >×</button>
              )}
            </span>
          ))}
          {!readOnly && (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onBlur={() => addKeyword(draft)}
              placeholder={keywords.length === 0 ? '키워드 입력 후 Enter' : '+ 추가'}
              className="kw-chip__input"
            />
          )}
          {readOnly && keywords.length === 0 && <span className="analysis__empty">아직 등록된 키워드가 없습니다.</span>}
        </div>
        {!readOnly && (
          <p className="analysis__hint"><Plus size={10} /> Enter 또는 콤마로 추가, Backspace로 삭제</p>
        )}
      </div>

      <div className="analysis__section">
        <label className="analysis__label" htmlFor={`analysis-${postingId}`}>해석 / 분석</label>
        {readOnly ? (
          <div className="analysis__readonly">
            {analysis.trim() ? analysis : <span className="analysis__empty">아직 해석이 없습니다.</span>}
          </div>
        ) : (
          <textarea
            id={`analysis-${postingId}`}
            className="analysis__textarea"
            value={analysis}
            onChange={handleAnalysisChange}
            placeholder="이 공고를 어떻게 해석했나? 무엇이 매력적이고 무엇이 걸리나? 자유롭게 적어보세요."
            rows={6}
          />
        )}
      </div>
    </div>
  );
}
