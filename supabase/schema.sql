-- Supabase SQL Editor에서 실행하세요.
-- 테이블 이름: public.signups (복수형)

create table if not exists public.signups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists signups_email_unique on public.signups (email);
create unique index if not exists signups_phone_unique on public.signups (phone);

alter table public.signups enable row level security;

-- 서버 API(Service Role Key)만 insert 가능
grant usage on schema public to service_role;
grant all on table public.signups to service_role;

revoke all on table public.signups from anon, authenticated;

-- PostgREST 스키마 캐시 갱신
notify pgrst, 'reload schema';
