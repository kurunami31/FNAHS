-- feed comments can carry a photo attachment (data URL, same policy as post images)
alter table public.comments add column if not exists image_url text;
