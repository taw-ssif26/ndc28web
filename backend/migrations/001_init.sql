create table users(
 id serial primary key, name text not null, father text, mother text, parent_phone text,
 whatsapp text unique not null, group_no integer, roll text unique not null, email text unique not null,
 photo text, pw text not null,
 role text not null default 'student' check (role in ('student','admin','super')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created text default to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS'));
create index users_status_idx on users(status);
create table events(id serial primary key, title text not null, starts text, ends text, location text, link text, details text);
create table notices(id serial primary key, title text not null, body text, category text, pinned integer default 0,
 created text default to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS'));
create table resources(id serial primary key, title text not null, kind text, url text, description text);
create table groups(id serial primary key, no integer unique not null, link text);
create table gallery(id serial primary key, caption text, file text not null);
create table login_fails(k text not null, at double precision not null);
create index login_fails_k_idx on login_fails(k);
