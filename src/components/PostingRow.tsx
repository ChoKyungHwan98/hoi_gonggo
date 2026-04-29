import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FeedbackPanel from './FeedbackPanel';
import type { JobPosting, User } from '../types';

interface Props {
  posting: JobPosting;
  currentUser: User;
  isInstructor: boolean;
  onDeleted: () => void;
}

export default function PostingRow({ posting, currentUser, isInstructor, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Partial<JobPosting>>({});

  const val = <K extends keyof JobPosting>(key: K): JobPosting[K] =>
    key in editing ? (editing[key] as JobPosting[K]) : posting[key];

  const update = (key: keyof JobPosting, value: string | number | null) => {
    setEditing((prev) => ({ ...prev, [key]: value }));
    supabase.from('job_postings').update({ [key]: value || null }).eq('id', posting.id);
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

  const colSpan = isInstructor ? 9 : 8;

  return (
    <>
      <tr className="posting-row">
        {isInstructor && (
          <td className="cell" style={{ color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
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
              {val('job_deadline_date') && <span>{val('job_deadline_date') as string}</span>}
              {val('deadline_text') && <span className="deadline-badge">{val('deadline_text') as string}</span>}
              {!val('job_deadline_date') && !val('deadline_text') && <span>—</span>}
            </div>
          ) : (
            <div className="deadline-cell">
              <input
                type="date"
                className="cell__edit cell__edit--date"
                value={(val('job_deadline_date') as string) ?? ''}
                onChange={(e) => update('job_deadline_date', e.target.value)}
              />
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
            className={`btn btn--icon ${expanded ? 'btn--active' : ''}`}
            onClick={() => setExpanded(!expanded)}
            title="피드백"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
            <FeedbackPanel postingId={posting.id} currentUser={currentUser} />
          </td>
        </tr>
      )}
    </>
  );
}
