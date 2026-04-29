import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { User, Feedback } from '../types';

interface Props {
  postingId: string;
  currentUser: User;
  onClose?: () => void;
}

export default function FeedbackPanel({ postingId, currentUser, onClose }: Props) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchFeedbacks = useCallback(async () => {
    const { data } = await supabase
      .from('feedback')
      .select('*, users(name)')
      .eq('posting_id', postingId)
      .order('created_at', { ascending: true });
    setFeedbacks((data as Feedback[]) ?? []);
  }, [postingId]);

  useEffect(() => {
    fetchFeedbacks();
    setTimeout(() => inputRef.current?.focus(), 80);

    const channel = supabase
      .channel(`feedback-${postingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback', filter: `posting_id=eq.${postingId}` }, fetchFeedbacks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postingId, fetchFeedbacks]);

  // 새 피드백 추가 시 스크롤 하단
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [feedbacks.length]);

  // Esc 키로 패널 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async (feedbackId: string) => {
    // 즉시 UI 반영 (optimistic)
    setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
    const { error } = await supabase.from('feedback').delete().eq('id', feedbackId);
    if (error) fetchFeedbacks(); // 실패 시 롤백
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const newText = text.trim();
    setText('');
    const { error } = await supabase.from('feedback').insert({
      posting_id: postingId,
      author_id: currentUser.id,
      content: newText,
    });
    setSaving(false);
    if (error) {
      setText(newText);
    } else {
      fetchFeedbacks();
    }
    inputRef.current?.focus();
  };

  const isInstructor = currentUser.role === 'instructor';

  return (
    <div className="feedback">
      {onClose && (
        <button className="feedback__close" onClick={onClose} title="닫기 (Esc)">
          <X size={14} />
        </button>
      )}
      {feedbacks.length === 0 ? (
        <p className="feedback__empty">
          {isInstructor
            ? '아직 피드백이 없습니다. 첫 피드백을 남겨보세요.'
            : '강사님의 피드백을 기다리는 중입니다.'}
        </p>
      ) : (
        <ul className="feedback__list" ref={listRef}>
          {feedbacks.map((f) => {
            const isMine = f.author_id === currentUser.id;
            return (
              <li key={f.id} className={`feedback__item ${isMine ? 'feedback__item--mine' : ''}`}>
                <div className="feedback__bubble">
                  <div className="feedback__bubble-header">
                    <span className="feedback__author">{f.users?.name ?? '?'}</span>
                    <span className="feedback__date">{new Date(f.created_at).toLocaleDateString('ko-KR')}</span>
                    {isMine && (
                      <button className="feedback__delete" onClick={() => handleDelete(f.id)} title="삭제">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <p className="feedback__content">{f.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isInstructor && (
        <div className="feedback__input-row">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="피드백 입력 후 Enter  (Esc로 닫기)"
            className="feedback__input"
          />
          <button
            className="btn btn--sm btn--primary"
            onClick={handleSubmit}
            disabled={saving || !text.trim()}
          >
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
