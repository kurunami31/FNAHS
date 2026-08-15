-- comments can reply to other comments (parent_id null = top-level thread)
alter table public.comments add column if not exists parent_id uuid
  references public.comments (id) on delete cascade;

create index if not exists comments_parent_id_idx on public.comments (parent_id);

-- notify the author of the comment being replied to (skip self-replies),
-- in addition to the existing post-author notification
create or replace function public.notify_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_name text;
  v_target uuid;
begin
  -- notify the post author (skip self-comments)
  select user_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    select full_name into v_name from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_author, 'mention', coalesce(v_name, 'A member') || ' commented on your post',
            left(new.content, 120), '/app/feed');
  end if;

  -- notify the author of the comment being replied to
  if new.parent_id is not null then
    select user_id into v_target from public.comments where id = new.parent_id;
    if v_target is not null and v_target <> new.user_id then
      select full_name into v_name from public.profiles where id = new.user_id;
      insert into public.notifications (user_id, kind, title, body, link)
      values (v_target, 'mention', coalesce(v_name, 'A member') || ' replied to your comment',
              left(new.content, 120), '/app/feed');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_comment on public.comments;
create trigger notify_comment
  after insert on public.comments
  for each row execute function public.notify_comment();