import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [filterStudent, setFilterStudent] = useState<string | null>(null);

  const fetchPostings = useCallback(async (user: User) => {
    setLoading(true);
    let query = supabase
      .from('job_postings')
      .select('*, user:users!user_id(name), feedback!posting_id(id)')
      .order('created_at', { ascending: false });

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

    const channel = supabase
      .channel('job_postings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, () => {
        fetchPostings(currentUser);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser, fetchPostings]);

  const students = useMemo(() => {
    const names = postings.map(p => p.user?.name).filter((n): n is string => !!n);
    return [...new Set(names)];
  }, [postings]);

  const displayedPostings = useMemo(() => {
    if (!filterStudent) return postings;
    return postings.filter(p => p.user?.name === filterStudent);
  }, [postings, filterStudent]);

  if (!currentUser) {
    return <NameSelector onSelect={setCurrentUser} />;
  }

  const isInstructor = currentUser.role === 'instructor';

  const urgentCount = postings.filter(p => {
    if (!p.job_deadline_date) return false;
    const diff = (new Date(p.job_deadline_date).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  const feedbackPendingCount = postings.filter(p => (p.feedback?.length ?? 0) === 0).length;

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

      {isInstructor && postings.length > 0 && (
        <div className="stats-bar">
          <span className="stats-bar__item">전체 공고 <strong>{postings.length}</strong></span>
          {urgentCount > 0 && (
            <span className="stats-bar__item stats-bar__item--urgent">마감 임박 <strong>{urgentCount}</strong></span>
          )}
          {feedbackPendingCount > 0 && (
            <span className="stats-bar__item stats-bar__item--pending">피드백 필요 <strong>{feedbackPendingCount}</strong></span>
          )}
        </div>
      )}

      {isInstructor && students.length > 0 && (
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterStudent === null ? 'filter-tab--active' : ''}`}
            onClick={() => setFilterStudent(null)}
          >
            전체 <span className="filter-tab__count">{postings.length}</span>
          </button>
          {students.map(name => (
            <button
              key={name}
              className={`filter-tab ${filterStudent === name ? 'filter-tab--active' : ''}`}
              onClick={() => setFilterStudent(name)}
            >
              {name} <span className="filter-tab__count">{postings.filter(p => p.user?.name === name).length}</span>
            </button>
          ))}
        </div>
      )}

      <main className="app__main">
        {loading ? (
          <p className="app__empty">불러오는 중...</p>
        ) : displayedPostings.length === 0 ? (
          <div className="app__empty">
            <p>{filterStudent ? `${filterStudent}님의 공고가 없습니다.` : '등록된 공고가 없습니다.'}</p>
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
                  <th className="th th--status">상태</th>
                  <th className="th th--date">등록일</th>
                  <th className="th th--date">갱신일/마감일</th>
                  <th className="th th--score">관심도</th>
                  <th className="th th--notes">비고</th>
                  <th className="th th--actions"></th>
                </tr>
              </thead>
              <tbody>
                {displayedPostings.map((p) => (
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
