create table files(id serial primary key, kind text not null check (kind in ('p','g')), data bytea not null, mime text not null default 'image/jpeg');
