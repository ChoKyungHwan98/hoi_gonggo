export interface User {
  id: string;
  name: string;
  role: 'student' | 'instructor';
}

export interface JobPosting {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  company: string | null;
  job_type: string | null;
  job_posted_date: string | null;
  job_deadline_date: string | null;
  deadline_text: string | null;
  interest_score: number | null;
  notes: string | null;
  created_at: string;
  status: string | null;
  user?: { name: string } | null;
  feedback?: { id: string }[] | null;
}

export interface Feedback {
  id: string;
  posting_id: string;
  author_id: string;
  content: string;
  created_at: string;
  users?: { name: string };
}
