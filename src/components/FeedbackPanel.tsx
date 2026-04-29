import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { User, Feedback } from '../types';

interface Props {
  postingId: string;
  currentUser: User;
}

export default function FeedbackPanel({ postingId, currentUser }: Props) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setTimeout(() => inputRef.current?.focus(), 100);

    const channel = supabase
      .channel(`feedback-${postingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback', filter: `posting_id=eq.${postingId}` }, fetchFeedbacks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postingId, fetchFeedbacks]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const newText = text.trim();
    setText(''); // 먼저 비워서 빠른 UX
    const { error } = await supabase.from('feedback').insert({
      posting_id: postingId,
      author_id: currentUser.id,
      content: newText,
    });
    setSaving(false);
    if (error) {
      setText(newText); // 실패 시 복원
    } else {
      fetchFeedbacks(); // Realtime 대기 없이 즉시 갱신
    }
    inputRef.current?.focus();
  };

  const handleDelete = async (feedbackId: string) => {
    await supabase.from('feedback').delete().eq('id', feedbackId);
    fetchFeedbacks();
  };

  const isInstructor = currentUser.role === 'instructor';

  return (
    <div className="feedback">
      {feedbacks.length === 0 ? (
        <p className="feedback__empty">
          {isInstructor ? '아직 피드백이 없습니다. 첫 피드백을 남겨보세요.' : '강사님의 피드백을 기다리는 중입니다.'}
        </p>
      ) : (
        <ul className="feedback__list">
          {feedbacks.map((f) => {
            const isMine = f.author_id === currentUser.id;
            return (
              <li key={f.id} className={`feedback__item ${isMine ? 'feedback__item--mine' : ''}`}>
                <div className="feedback__bubble">
                  <div className="feedback__bubble-header">
                    <span className="feedback__author">{f.users?.name ?? '?'}</span>
                    <span className="feedback__date">{new Date(f.created_at).toLocaleDateString('ko-KR')}</span>
                    {isMine && (
                      <button
                        className="feedback__delete"
                        onClick={() => handleDelete(f.id)}
                        title="삭제"
                      >
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
            placeholder="피드백 입력 후 Enter"
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
