import { useState, useRef, useEffect } from 'react';
import { ExternalLink, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FeedbackPanel from './FeedbackPanel';
import { deadlineUrgency, getDday, isExpired } from '../lib/deadline';
import { useSaveStatus } from '../contexts/SaveStatusContext';
import type { JobPosting, User } from '../types';

interface Props {
  posting: JobPosting;
  currentUser: User;
  isInstructor: boolean;
  onDeleted: () => void;
}

const STATUS_OPTIONS = ['미지원', '지원완료', '서류통과', '면접', '최종합격', '불합격'];

const statusStyle = (s: string | null) => {
  switch (s) {
    case '지원완료': return 'status--applied';
    case '서류통과': return 'status--pass';
    case '면접': return 'status--interview';
    case '최종합격': return 'status--hired';
    case '불합격': return 'status--rejected';
    default: return 'status--none';
  }
};

export default function PostingRow({ posting, currentUser, isInstructor, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Partial<JobPosting>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { setStatus: setSaveStatus } = useSaveStatus();

  // 언마운트 시 pending timer 정리 + 즉시 flush 시도
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const val = <K extends keyof JobPosting>(key: K): JobPosting[K] =>
    key in editing ? (editing[key] as JobPosting[K]) : posting[key];

  const writeToDb = async (key: keyof JobPosting, dbValue: string | number | null) => {
    setSaveStatus('saving');
    const { error } = await supabase
      .from('job_postings')
      .update({ [key]: dbValue })
      .eq('id', posting.id);
    if (error) {
      setSaveStatus('error');
      // 실패 시 로컬 상태 롤백
      setEditing((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setSaveStatus('saved');
    }
  };

  // debounceMs > 0: 텍스트 입력처럼 연속 발생하는 변경 (회사명, 직무, 비고)
  // debounceMs = 0: 즉시 반영 (status, score, 날짜)
  const update = (key: keyof JobPosting, value: string | number | null, debounceMs = 0) => {
    const dbValue = (value === '' || value === null || value === undefined) ? null : value;
    setEditing((prev) => ({ ...prev, [key]: dbValue }));

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);

    if (debounceMs > 0) {
      debounceTimers.current[key] = setTimeout(() => {
        writeToDb(key, dbValue);
        delete debounceTimers.current[key];
      }, debounceMs);
    } else {
      writeToDb(key, dbValue);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 공고를 삭제하시겠어요?')) return;
    await supabase.from('job_postings').delete().eq('id', posting.id);
    onDeleted();
  };

  const scoreColor = (s: number | null) => {
    if (!s) return '';
    if (s >= 8) return 'score--high';
    if (s >= 5) return 'score--mid';
    return 'score--low';
  };

  const colSpan = isInstructor ? 11 : 10;
  const feedbackCount = posting.feedback?.length ?? 0;
  const deadlineDateVal = val('job_deadline_date') as string | null;
  const deadlineTextVal = val('deadline_text') as string | null;
  // 텍스트("채용시 마감" 등)가 있으면 날짜 기반 상태는 무시 — 만료 아님
  const urgency = deadlineTextVal ? null : deadlineUrgency(deadlineDateVal);
  const dday = deadlineTextVal ? null : getDday(deadlineDateVal);
  const expired = !deadlineTextVal && isExpired(deadlineDateVal);

  return (
    <>
      <tr className={`posting-row ${urgency ? `posting-row--${urgency}` : ''} ${expired ? 'posting-row--expired' : ''}`}>
        {isInstructor && (
          <td className="cell cell--student">
            {posting.user?.name ?? '—'}
          </td>
        )}
        <td className="cell cell--title">
          <a href={val('url') as string} target="_blank" rel="noreferrer" className="posting-row__link">
            <ExternalLink size={12} />
            <span>{val('title') || '(제목 없음)'}</span>
          </a>
        </td>
        <td className="cell">
          {isInstructor ? (
            <span>{val('company') || '—'}</span>
          ) : (
            <input
              className="cell__edit"
              value={(val('company') as string) ?? ''}
              onChange={(e) => update('company', e.target.value, 400)}
              placeholder="회사명"
            />
          )}
        </td>
        <td className="cell">
          {isInstructor ? (
            <span>{val('job_type') || '—'}</span>
          ) : (
            <input
              className="cell__edit"
              value={(val('job_type') as string) ?? ''}
              onChange={(e) => update('job_type', e.target.value, 400)}
              placeholder="직무"
            />
          )}
        </td>
        <td className="cell cell--status">
          {isInstructor ? (
            <span className={`status-badge ${statusStyle(val('status') as string | null)}`}>
              {val('status') || '미지원'}
            </span>
          ) : (
            <select
              className={`status-select ${statusStyle(val('status') as string | null)}`}
              value={(val('status') as string) ?? '미지원'}
              onChange={(e) => update('status', e.target.value)}
            >
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </td>
        <td className="cell cell--date">
          {isInstructor ? (
            <span>{val('job_posted_date') || '—'}</span>
          ) : (
            <input
              type="date"
              className="cell__edit cell__edit--date"
              value={(val('job_posted_date') as string) ?? ''}
              onChange={(e) => update('job_posted_date', e.target.value)}
            />
          )}
        </td>
        <td className="cell cell--date cell--updated">
          {isInstructor ? (
            <span>{val('job_updated_date') || '—'}</span>
          ) : (
            <input
              type="date"
              className="cell__edit cell__edit--date"
              value={(val('job_updated_date') as string) ?? ''}
              onChange={(e) => update('job_updated_date', e.target.value)}
            />
          )}
        </td>
        <td className="cell cell--date">
          {(() => {
            // 텍스트가 있으면 그것만 표시 (날짜/D-day 무시 — 채용시 마감 같은 케이스)
            if (deadlineTextVal) {
              return (
                <div className="deadline-cell">
                  <span className="deadline-badge deadline-badge--primary">
                    {deadlineTextVal}
                    {!isInstructor && (
                      <button
                        className="deadline-badge__clear"
                        onClick={() => update('deadline_text', null)}
                        title="텍스트 지우기 (날짜 입력으로 전환)"
                      >×</button>
                    )}
                  </span>
                </div>
              );
            }
            // 텍스트 없음 → 날짜 + D-day
            if (isInstructor) {
              return (
                <div className="deadline-cell">
                  <div className="deadline-cell__row">
                    {deadlineDateVal && <span className="deadline-date">{deadlineDateVal}</span>}
                    {dday && (
                      <span className={`dday-badge ${expired ? 'dday-badge--expired' : urgency ? `dday-badge--${urgency}` : ''}`}>{dday}</span>
                    )}
                  </div>
                  {!deadlineDateVal && <span>—</span>}
                </div>
              );
            }
            return (
              <div className="deadline-cell">
                <div className="deadline-cell__row">
                  <input
                    type="date"
                    className="cell__edit cell__edit--date"
                    value={deadlineDateVal ?? ''}
                    onChange={(e) => update('job_deadline_date', e.target.value)}
                  />
                  {dday && (
                    <span className={`dday-badge ${expired ? 'dday-badge--expired' : urgency ? `dday-badge--${urgency}` : ''}`}>{dday}</span>
                  )}
                </div>
              </div>
            );
          })()}
        </td>
        <td className="cell cell--score">
          {isInstructor ? (
            <span className={scoreColor(val('interest_score') as number | null)}>
              {val('interest_score') ?? '—'}
            </span>
          ) : (
            <input
              type="number"
              min={1} max={10}
              className={`cell__edit cell__edit--score ${scoreColor(val('interest_score') as number | null)}`}
              value={(val('interest_score') as number) ?? ''}
              onChange={(e) => update('interest_score', e.target.value ? Math.min(10, Math.max(1, Number(e.target.value))) : null)}
            />
          )}
        </td>
        <td className="cell cell--notes">
          {isInstructor ? (
            <span>{val('notes') || '—'}</span>
          ) : (
            <input
              className="cell__edit"
              value={(val('notes') as string) ?? ''}
              onChange={(e) => update('notes', e.target.value, 400)}
              placeholder="비고"
            />
          )}
        </td>
        <td className="cell cell--actions">
          <button
            className={`btn btn--feedback ${expanded ? 'btn--active' : ''} ${feedbackCount > 0 ? 'btn--has-feedback' : ''}`}
            onClick={() => setExpanded(!expanded)}
            title={feedbackCount > 0 ? `피드백 ${feedbackCount}개` : '피드백'}
          >
            <MessageSquare size={14} />
            {feedbackCount > 0 && <span className="feedback-badge">{feedbackCount}</span>}
          </button>
          {!isInstructor && currentUser.id === posting.user_id && (
            <button className="btn btn--icon btn--danger" onClick={handleDelete} title="삭제">
              <Trash2 size={16} />
            </button>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="posting-row__feedback-row">
          <td colSpan={colSpan}>
            <FeedbackPanel postingId={posting.id} currentUser={currentUser} onClose={() => setExpanded(false)} />
          </td>
        </tr>
      )}
    </>
  );
}
