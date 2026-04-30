import { useState, useRef, useEffect } from 'react';
import { ExternalLink, Trash2, MessageSquare, BookOpen, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import FeedbackPanel from './FeedbackPanel';
import AnalysisPanel from './AnalysisPanel';
import { deadlineUrgency, getDday, isExpired } from '../lib/deadline';
import { useSaveStatus } from '../contexts/SaveStatusContext';
import type { JobPosting, User } from '../types';

interface Props {
  posting: JobPosting;
  index: number;
  currentUser: User;
  isInstructor: boolean;
  onDeleted: () => void;
  onLocalUpdate?: (id: string, patch: Partial<JobPosting>) => void;
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

export default function PostingRow({ posting, index, currentUser, isInstructor, onDeleted, onLocalUpdate }: Props) {
  const [expanded, setExpanded] = useState<'feedback' | 'analysis' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    // 낙관적 부모 state 패치 — 정렬/표시 즉시 반영
    onLocalUpdate?.(posting.id, { [key]: dbValue } as Partial<JobPosting>);

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
    await supabase.from('job_postings').delete().eq('id', posting.id);
    setShowDeleteConfirm(false);
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
        <td className="cell cell--no">
          {isInstructor || currentUser.id !== posting.user_id ? (
            <span>{index}</span>
          ) : (
            <input
              type="number"
              min={1}
              className="cell__edit cell__edit--no"
              value={(val('display_no') as number) ?? index}
              onChange={(e) => update('display_no', e.target.value ? Number(e.target.value) : null, 400)}
              title="번호 (수정하면 정렬 위치 바뀜)"
            />
          )}
        </td>
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
        <td className="cell cell--date cell--posted-updated">
          {isInstructor ? (
            <div className="posted-updated">
              <span className="posted-updated__primary">{val('job_posted_date') || '—'}</span>
              {val('job_updated_date') && (
                <span className="posted-updated__secondary" title="수정일">
                  ↻ {val('job_updated_date') as string}
                </span>
              )}
            </div>
          ) : (
            <div className="posted-updated">
              <input
                type="date"
                className="cell__edit cell__edit--date posted-updated__primary"
                value={(val('job_posted_date') as string) ?? ''}
                onChange={(e) => update('job_posted_date', e.target.value)}
                title="등록일"
              />
              <input
                type="date"
                className="cell__edit cell__edit--date posted-updated__secondary"
                value={(val('job_updated_date') as string) ?? ''}
                onChange={(e) => update('job_updated_date', e.target.value)}
                title="수정일"
                placeholder="수정일"
              />
            </div>
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
            className={`btn btn--analysis ${expanded === 'analysis' ? 'btn--active' : ''} ${(posting.keywords || posting.analysis) ? 'btn--has-analysis' : ''}`}
            onClick={() => setExpanded(expanded === 'analysis' ? null : 'analysis')}
            title="분석 / 키워드"
          >
            <BookOpen size={14} />
          </button>
          <button
            className={`btn btn--feedback ${expanded === 'feedback' ? 'btn--active' : ''} ${feedbackCount > 0 ? 'btn--has-feedback' : ''}`}
            onClick={() => setExpanded(expanded === 'feedback' ? null : 'feedback')}
            title={feedbackCount > 0 ? `피드백 ${feedbackCount}개` : '피드백'}
          >
            <MessageSquare size={14} />
            {feedbackCount > 0 && <span className="feedback-badge">{feedbackCount}</span>}
          </button>
          {!isInstructor && currentUser.id === posting.user_id && (
            <button
              className="btn btn--icon btn--danger btn--delete-spaced"
              onClick={() => { setExpanded(null); setShowDeleteConfirm(true); }}
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          )}
        </td>
      </tr>

      {showDeleteConfirm && (
        <tr className="posting-row__feedback-row">
          <td colSpan={colSpan}>
            <div className="delete-confirm" role="alertdialog" aria-modal="true">
              <div className="delete-confirm__icon"><AlertTriangle size={20} /></div>
              <div className="delete-confirm__body">
                <p className="delete-confirm__title">정말 이 공고를 삭제할까요?</p>
                <p className="delete-confirm__detail">
                  <strong>{(val('title') as string) || '(제목 없음)'}</strong>
                  {val('company') && <span className="delete-confirm__company"> · {val('company') as string}</span>}
                </p>
                <p className="delete-confirm__warning">삭제하면 피드백과 분석 내용도 함께 사라지고 되돌릴 수 없어요.</p>
              </div>
              <div className="delete-confirm__actions">
                <button className="btn" onClick={() => setShowDeleteConfirm(false)}>취소</button>
                <button className="btn btn--danger-filled" onClick={handleDelete}>
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {expanded === 'feedback' && (
        <tr className="posting-row__feedback-row">
          <td colSpan={colSpan}>
            <FeedbackPanel postingId={posting.id} currentUser={currentUser} onClose={() => setExpanded(null)} />
          </td>
        </tr>
      )}

      {expanded === 'analysis' && (
        <tr className="posting-row__feedback-row">
          <td colSpan={colSpan}>
            <AnalysisPanel
              postingId={posting.id}
              initialKeywords={posting.keywords}
              initialAnalysis={posting.analysis}
              readOnly={isInstructor || currentUser.id !== posting.user_id}
              onClose={() => setExpanded(null)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
