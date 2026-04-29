import { useState } from 'react';
import { ExternalLink, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FeedbackPanel from './FeedbackPanel';
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

const deadlineUrgency = (dateStr: string | null): 'urgent' | 'soon' | null => {
  if (!dateStr) return null;
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  if (diff < 0) return null;
  if (diff <= 3) return 'urgent';
  if (diff <= 7) return 'soon';
  return null;
};

const getDday = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff < 0) return '마감';
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
};

export default function PostingRow({ posting, currentUser, isInstructor, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Partial<JobPosting>>({});

  const val = <K extends keyof JobPosting>(key: K): JobPosting[K] =>
    key in editing ? (editing[key] as JobPosting[K]) : posting[key];

  const update = async (key: keyof JobPosting, value: string | number | null) => {
    const dbValue = (value === '' || value === null || value === undefined) ? null : value;
    setEditing((prev) => ({ ...prev, [key]: dbValue }));
    const { error } = await supabase
      .from('job_postings')
      .update({ [key]: dbValue })
      .eq('id', posting.id);
    if (error) {
      // 실패 시 로컬 상태 롤백
      setEditing((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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

  const colSpan = isInstructor ? 10 : 9;
  const feedbackCount = posting.feedback?.length ?? 0;
  const deadlineDateVal = val('job_deadline_date') as string | null;
  const urgency = deadlineUrgency(deadlineDateVal);
  const dday = getDday(deadlineDateVal);

  return (
    <>
      <tr className={`posting-row ${urgency ? `posting-row--${urgency}` : ''}`}>
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
              onChange={(e) => update('company', e.target.value)}
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
              onChange={(e) => update('job_type', e.target.value)}
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
        <td className="cell cell--date">
          {isInstructor ? (
            <div className="deadline-cell">
              <div className="deadline-cell__row">
                {deadlineDateVal && <span className="deadline-date">{deadlineDateVal}</span>}
                {dday && (
                  <span className={`dday-badge ${urgency ? `dday-badge--${urgency}` : ''}`}>{dday}</span>
                )}
              </div>
              {val('deadline_text') && <span className="deadline-badge">{val('deadline_text') as string}</span>}
              {!deadlineDateVal && !val('deadline_text') && <span>—</span>}
            </div>
          ) : (
            <div className="deadline-cell">
              <div className="deadline-cell__row">
                <input
                  type="date"
                  className="cell__edit cell__edit--date"
                  value={deadlineDateVal ?? ''}
                  onChange={(e) => update('job_deadline_date', e.target.value)}
                />
                {dday && (
                  <span className={`dday-badge ${urgency ? `dday-badge--${urgency}` : ''}`}>{dday}</span>
                )}
              </div>
              {val('deadline_text') && (
                <span className="deadline-badge">{val('deadline_text') as string}</span>
              )}
            </div>
          )}
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
              onChange={(e) => update('notes', e.target.value)}
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
