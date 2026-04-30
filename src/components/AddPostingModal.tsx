import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { parseOgFromUrl } from '../lib/parseOg';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

interface Props {
  user: User;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddPostingModal({ user, onClose, onAdded }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [jobType, setJobType] = useState('');
  const [postedDate, setPostedDate] = useState('');
  const [updatedDate, setUpdatedDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineText, setDeadlineText] = useState('');
  const [score, setScore] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleParseUrl = async () => {
    if (!url.trim()) return;
    setParsing(true);
    setError('');
    const og = await parseOgFromUrl(url.trim());
    if (og.title) setTitle(og.title);
    if (og.company) setCompany(og.company);
    if (og.postedDate) setPostedDate(og.postedDate);
    if (og.updatedDate) setUpdatedDate(og.updatedDate);
    if (og.deadlineDate) setDeadlineDate(og.deadlineDate);
    if (og.deadlineText) setDeadlineText(og.deadlineText);
    setParsing(false);
  };

  const handleUrlBlur = () => {
    if (url.trim() && !title) handleParseUrl();
  };

  const handleSave = async () => {
    if (!url.trim()) return;
    setSaving(true);
    setError('');

    // 다음 display_no = 사용자 중 max + 1. 컬럼 없으면 그냥 null 로.
    let nextNo: number | null = null;
    try {
      const { data: maxRow, error: maxErr } = await supabase
        .from('job_postings')
        .select('display_no')
        .eq('user_id', user.id)
        .order('display_no', { ascending: false, nullsFirst: false })
        .limit(1);
      if (!maxErr) nextNo = ((maxRow?.[0]?.display_no as number | null) ?? 0) + 1;
    } catch { /* display_no 컬럼 없음 — null로 진행 */ }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      url: url.trim(),
      title: title || null,
      company: company || null,
      job_type: jobType || null,
      job_posted_date: postedDate || null,
      job_updated_date: updatedDate || null,
      job_deadline_date: deadlineDate || null,
      deadline_text: deadlineText || null,
      interest_score: score !== '' ? Number(score) : null,
      notes: notes || null,
    };
    if (nextNo !== null) insertPayload.display_no = nextNo;

    const { error: insertError } = await supabase.from('job_postings').insert(insertPayload);

    setSaving(false);

    if (insertError) {
      setError(`저장 실패: ${insertError.message}`);
      return;
    }

    onAdded();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>공고 추가</h2>
          <button className="modal__close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal__body">
          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <label className="field">
            <span>공고 URL *</span>
            <div className="field__row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://www.saramin.co.kr/..."
                className="field__input field__input--grow"
              />
              <button className="btn btn--sm" onClick={handleParseUrl} disabled={parsing || !url.trim()}>
                {parsing ? <Loader2 size={14} className="spin" /> : '파싱'}
              </button>
            </div>
          </label>

          <div className="field__two-col">
            <label className="field">
              <span>제목</span>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="field__input" placeholder="자동 파싱 또는 직접 입력" />
            </label>
            <label className="field">
              <span>회사</span>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="field__input" placeholder="회사명" />
            </label>
          </div>

          <label className="field">
            <span>직무</span>
            <input
              type="text"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="field__input"
              placeholder="시스템기획, 콘텐츠기획 등 직접 입력"
            />
          </label>

          <div className="field__two-col">
            <label className="field">
              <span>등록일</span>
              <input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} className="field__input" />
            </label>
            <label className="field">
              <span>수정일</span>
              <input type="date" value={updatedDate} onChange={(e) => setUpdatedDate(e.target.value)} className="field__input" />
            </label>
          </div>

          <label className="field">
            <span>마감일 / 마감 텍스트</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="field__input" style={{ flex: 1 }} />
              <input
                type="text"
                value={deadlineText}
                onChange={(e) => setDeadlineText(e.target.value)}
                className="field__input"
                placeholder="채용시 마감, 상시채용 등"
                style={{ flex: 1, fontSize: 12, color: '#92400e' }}
              />
            </div>
          </label>

          <label className="field">
            <span>관심도 (1–10)</span>
            <input
              type="number"
              min={1} max={10}
              value={score}
              onChange={(e) => setScore(e.target.value === '' ? '' : Math.min(10, Math.max(1, Number(e.target.value))))}
              className="field__input field__input--narrow"
              placeholder="10"
            />
          </label>

          <label className="field">
            <span>비고</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="field__input field__textarea" placeholder="메모 자유 입력" rows={2} />
          </label>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>취소</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving || !url.trim()}>
            {saving ? <Loader2 size={16} className="spin" /> : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
