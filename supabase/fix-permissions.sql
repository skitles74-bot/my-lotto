-- 이미 schema.sql을 실행했는데 가입 오류가 날 때 SQL Editor에서 실행하세요.

grant usage on schema public to service_role;
grant all on table public.signups to service_role;

revoke all on table public.signups from anon, authenticated;

alter table public.signups enable row level security;

notify pgrst, 'reload schema';
