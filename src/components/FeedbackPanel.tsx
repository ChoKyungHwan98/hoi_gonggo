import { useState, useEffect } from 'react';
import { Send } from 'lucide-react';
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

  const fetchFeedbacks = async () => {
    const { data } = await supabase
      .from('feedback')
      .select('*, users(name)')
      .eq('posting_id', postingId)
      .order('created_at', { ascending: true });
    setFeedbacks((data as Feedback[]) ?? []);
  };

  useEffect(() => {
    fetchFeedbacks();

    const channel = supabase
      .channel(`feedback-${postingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback', filter: `posting_id=eq.${postingId}` }, fetchFeedbacks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postingId]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await supabase.from('feedback').insert({
      posting_id: postingId,
      author_id: currentUser.id,
      content: text.trim(),
    });
    setText('');
    setSaving(false);
  };

  return (
    <div className="feedback">
      {feedbacks.length > 0 && (
        <ul className="feedback__list">
          {feedbacks.map((f) => (
            <li key={f.id} className="feedback__item">
              <span className="feedback__author">{f.users?.name ?? '?'}</span>
              <span className="feedback__content">{f.content}</span>
              <span className="feedback__date">{new Date(f.created_at).toLocaleDateString('ko-KR')}</span>
            </li>
          ))}
        </ul>
      )}

      {currentUser.role === 'instructor' && (
        <div className="feedback__input-row">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="피드백 작성 후 Enter"
            className="feedback__input"
          />
          <button className="btn btn--sm btn--primary" onClick={handleSubmit} disabled={saving || !text.trim()}>
            <Send size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
