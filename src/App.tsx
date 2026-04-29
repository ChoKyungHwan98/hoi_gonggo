import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, LogOut, Search, ChevronUp, ChevronDown, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';
import NameSelector from './components/NameSelector';
import AddPostingModal from './components/AddPostingModal';
import PostingRow from './components/PostingRow';
import { daysUntil } from './lib/deadline';
import { SaveStatusProvider, useSaveStatus } from './contexts/SaveStatusContext';
import type { User, JobPosting } from './types';
import './App.css';

function SaveIndicator() {
  const { status } = useSaveStatus();
  if (status === 'idle') return null;
  if (status === 'saving') return <span className="save-indicator save-indicator--saving"><Loader2 size={12} className="spin" /> 저장 중</span>;
  if (status === 'saved') return <span className="save-indicator save-indicator--saved"><Check size={12} /> 저장됨</span>;
  return <span className="save-indicator save-indicator--error"><AlertCircle size={12} /> 저장 실패</span>;
}

type SortField = 'job_deadline_date' | 'interest_score' | 'created_at' | 'status';
type SortDir = 'asc' | 'desc';

export default function App() {
  return (
    <SaveStatusProvider>
      <AppContent />
    </SaveStatusProvider>
  );
}

function AppContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterStudent, setFilterStudent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchPostings = useCallback(async (user: User, silent = false) => {
    if (!silent) setLoading(true);
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

    const postingsChannel = supabase
      .channel('job_postings_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_postings' }, () => {
        fetchPostings(currentUser, true);
      })
      .subscribe();

    const feedbackChannel = supabase
      .channel('feedback_count_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
        fetchPostings(currentUser, true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postingsChannel);
      supabase.removeChannel(feedbackChannel);
    };
  }, [currentUser, fetchPostings]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const students = useMemo(() => {
    const names = postings.map(p => p.user?.name).filter((n): n is string => !!n);
    return [...new Set(names)];
  }, [postings]);

  const displayedPostings = useMemo(() => {
    let result = filterStudent
      ? postings.filter(p => p.user?.name === filterStudent)
      : postings;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.company?.toLowerCase().includes(q) ||
        p.job_type?.toLowerCase().includes(q)
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        const av = a[sortField] ?? '';
        const bv = b[sortField] ?? '';
        if (av === '' && bv !== '') return 1;
        if (av !== '' && bv === '') return -1;
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [postings, filterStudent, searchQuery, sortField, sortDir]);

  if (!currentUser) {
    return <NameSelector onSelect={setCurrentUser} />;
  }

  const isInstructor = currentUser.role === 'instructor';

  const urgentCount = postings.filter(p => {
    const diff = daysUntil(p.job_deadline_date);
    return diff !== null && diff >= 0 && diff <= 7;
  }).length;

  const feedbackPendingCount = postings.filter(p => (p.feedback?.length ?? 0) === 0).length;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon sort-icon--idle">↕</span>;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="sort-icon sort-icon--active" />
      : <ChevronDown size={12} className="sort-icon sort-icon--active" />;
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-left">
          <h1 className="app__title">공고 관리</h1>
          <span className="app__user-badge">
            {currentUser.name}
            {isInstructor && ' (강사)'}
          </span>
          <SaveIndicator />
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
            <span className="stats-bar__item stats-bar__item--urgent">⚠ 마감 임박 <strong>{urgentCount}</strong></span>
          )}
          {feedbackPendingCount > 0 && (
            <span className="stats-bar__item stats-bar__item--pending">💬 피드백 필요 <strong>{feedbackPendingCount}</strong></span>
          )}
        </div>
      )}

      <div className="toolbar">
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
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="공고명, 회사, 직무 검색"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      <main className="app__main">
        {loading ? (
          <div className="app__loading">
            <div className="skeleton-rows">
              {[1,2,3].map(i => <div key={i} className="skeleton-row" />)}
            </div>
          </div>
        ) : displayedPostings.length === 0 ? (
          <div className="app__empty">
            {searchQuery ? (
              <>
                <p>"{searchQuery}" 검색 결과가 없습니다.</p>
                <button className="btn" onClick={() => setSearchQuery('')}>검색 초기화</button>
              </>
            ) : (
              <>
                <p>{filterStudent ? `${filterStudent}님의 공고가 없습니다.` : '등록된 공고가 없습니다.'}</p>
                {!isInstructor && (
                  <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
                    <Plus size={16} /> 첫 공고 추가하기
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {isInstructor && <th className="th th--student">학생</th>}
                  <th className="th th--title">공고명</th>
                  <th className="th">회사</th>
                  <th className="th">직무</th>
                  <th className="th th--status th--sortable" onClick={() => handleSort('status')}>
                    상태 <SortIcon field="status" />
                  </th>
                  <th className="th th--date th--sortable" onClick={() => handleSort('created_at')}>
                    등록일 <SortIcon field="created_at" />
                  </th>
                  <th className="th th--date th--sortable" onClick={() => handleSort('job_deadline_date')}>
                    마감일 <SortIcon field="job_deadline_date" />
                  </th>
                  <th className="th th--score th--sortable" onClick={() => handleSort('interest_score')}>
                    관심도 <SortIcon field="interest_score" />
                  </th>
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
