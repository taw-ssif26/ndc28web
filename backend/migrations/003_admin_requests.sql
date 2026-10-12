-- Students apply to become admin (at registration or any time later). Only the super admin decides.
create table admin_requests(
 id serial primary key, user_id integer not null references users(id) on delete cascade, reason text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created text default to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS'));
create unique index one_pending_request on admin_requests(user_id) where status='pending';
