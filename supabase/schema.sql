-- Supabase SQL Editor에서 실행하세요.
-- Table Editor → signups 테이블이 생성됩니다.

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'),
  email text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  created_at timestamptz not null default now()
);

create unique index if not exists signups_email_unique on public.signups (email);
create unique index if not exists signups_phone_unique on public.signups (phone);

alter table public.signups enable row level security;

-- 클라이언트 직접 접근 차단 (서버 API의 Service Role Key만 사용)
revoke all on table public.signups from anon, authenticated;
