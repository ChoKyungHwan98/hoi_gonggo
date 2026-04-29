import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import type { User } from '../types';

interface Props {
  onSelect: (user: User) => void;
}

export default function NameSelector({ onSelect }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('users')
      .select('*')
      .order('role', { ascending: false })
      .then(({ data }) => {
        setUsers((data as User[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="name-selector">
      <div className="name-selector__card">
        <h1 className="name-selector__title">공고 관리</h1>
        <p className="name-selector__sub">이름을 선택하세요</p>
        {loading ? (
          <p className="name-selector__loading">불러오는 중...</p>
        ) : (
          <div className="name-selector__list">
            {users.map((u) => (
              <button
                key={u.id}
                className={`name-selector__btn ${u.role === 'instructor' ? 'name-selector__btn--instructor' : ''}`}
                onClick={() => onSelect(u)}
              >
                {u.name}
                {u.role === 'instructor' && <span className="name-selector__badge">강사</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
