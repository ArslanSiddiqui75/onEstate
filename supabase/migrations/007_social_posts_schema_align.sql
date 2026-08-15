-- Legacy installs of social_posts had a `content` column that is NOT NULL with
-- no default. The app writes `caption` only, so every Compose insert failed
-- with a null violation and the UI silently reset after "Saving…".
-- Give `content` a default so omitted inserts succeed without dropping the column.

alter table public.social_posts
  alter column content set default '';

alter table public.social_posts
  alter column caption set default '';
