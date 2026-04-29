import { useState, useEffect, useCallback } from 'react';
import { Plus, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';
import NameSelector from './components/NameSelector';
import AddPostingModal from './components/AddPostingModal';
import PostingRow from './components/PostingRow';
import type { User, JobPosting } from './types';
import './App.css';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPostings = useCallback(async (user: User) => {
    setLoading(true);
    let query = supabase
      .from('job_postings')
      .select('*, user:users!user_id(name)')
      .order('created_at', { ascending: false });

    // 학생은 자기 공고만, 강사는 전체 조회
    if (user.role === 'student') {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query;
    setPostings((data as JobPosting[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchPostings(currentUser);

    // Realtime: 다른 사용자가 공고를 추가/수정/삭제하면 자동 갱신
    const channel = supabase
      .channel('job_postings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, () => {
        fetchPostings(currentUser);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, fetchPostings]);

  if (!currentUser) {
    return <NameSelector onSelect={setCurrentUser} />;
  }

  const isInstructor = currentUser.role === 'instructor';

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-left">
          <h1 className="app__title">공고 관리</h1>
          <span className="app__user-badge">
            {currentUser.name}
            {isInstructor && ' (강사)'}
          </span>
        </div>
        <div className="app__header-right">
          {!isInstructor && (
            <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> 공고 추가
            </button>
          )}
          <button className="btn btn--ghost" onClick={() => setCurrentUser(null)} title="이름 변경">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="app__main">
        {loading ? (
          <p className="app__empty">불러오는 중...</p>
        ) : postings.length === 0 ? (
          <div className="app__empty">
            <p>등록된 공고가 없습니다.</p>
            {!isInstructor && (
              <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> 첫 공고 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {isInstructor && <th className="th">학생</th>}
                  <th className="th th--title">공고명</th>
                  <th className="th">회사</th>
                  <th className="th">직무</th>
                  <th className="th th--date">등록일</th>
                  <th className="th th--date">갱신일/마감일</th>
                  <th className="th th--score">관심도</th>
                  <th className="th th--notes">비고</th>
                  <th className="th th--actions"></th>
                </tr>
              </thead>
              <tbody>
                {postings.map((p) => (
                  <PostingRow
                    key={p.id}
                    posting={p}
                    currentUser={currentUser}
                    isInstructor={isInstructor}
                    onDeleted={() => fetchPostings(currentUser)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showAdd && (
        <AddPostingModal
          user={currentUser}
          onClose={() => setShowAdd(false)}
          onAdded={() => fetchPostings(currentUser)}
        />
      )}
    </div>
  );
}
