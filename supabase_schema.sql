-- ========================================
-- 공고 관리 협업 툴 — Supabase 스키마
-- 새 Supabase 프로젝트에서 SQL Editor에 붙여넣고 실행
-- ========================================

-- 1. 사용자 테이블
CREATE TABLE users (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'instructor'))
);

-- 2. 초기 사용자 4명 (이름 바꾸고 싶으면 여기서 수정)
INSERT INTO users (name, role) VALUES
  ('조경환', 'student'),
  ('학생2',  'student'),
  ('학생3',  'student'),
  ('강사님', 'instructor');

-- 3. 공고 테이블
CREATE TABLE job_postings (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID    REFERENCES users(id) ON DELETE CASCADE,
  url               TEXT    NOT NULL,
  title             TEXT,
  company           TEXT,
  job_type          TEXT,
  job_posted_date   DATE,
  job_updated_date  DATE,
  job_deadline_date DATE,
  interest_score    INTEGER CHECK (interest_score BETWEEN 1 AND 10),
  notes             TEXT,
  keywords          TEXT,
  analysis          TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON job_postings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. 피드백 테이블
CREATE TABLE feedback (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  posting_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES users(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON feedback FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Realtime (feedback 테이블만 활성화)
-- Supabase 대시보드 → Database → Replication → feedback 체크

-- ========================================
-- 완료! 이제 .env 파일에 URL과 ANON_KEY 입력하세요.
-- ========================================
