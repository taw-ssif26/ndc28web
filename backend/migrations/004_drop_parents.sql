-- Parents' details are no longer collected. This PERMANENTLY deletes the stored values.
alter table users drop column if exists father, drop column if exists mother, drop column if exists parent_phone;
